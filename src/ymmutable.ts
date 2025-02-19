import * as Y from 'yjs';
import { merge, Observable, ReplaySubject, Subject } from 'rxjs';
import { debounce, debounceTime } from 'rxjs/operators';
import { YMultiDocUndoManager } from 'y-utility/y-multidoc-undomanager';
import { OperationsRecorderProxy, OperationsCompressor, OperationsApplierJson, OperationsApplierYjs, YDocType } from '.';
import { ID, DeepReadonly } from '@csbenjamin/common';

interface YmmutableConstructorOptions {
  debounceDuration?: number;
  pathMap?: WeakMap<any, { parent: any; key: number | string | null }>;
  ymmutableMap?: WeakMap<any, Ymmutable<any>>;
  undoManager?: YMultiDocUndoManager;
}

export class Ymmutable<S extends Object> implements YDocType {
  public immutable: DeepReadonly<S> = {} as any;
  private destroyed = false;
  private proxy: OperationsRecorderProxy<S>;
  private _onUpdate = new Subject<Uint8Array>();
  public onUpdate = this._onUpdate.asObservable();

  private handle: any;
  private doc = new Y.Doc();
  private debounceSubject = new Subject<void>();
  private isPending = false;
  private pendingUpdates: Uint8Array[] = [];
  private remoteReference = {};

  private changeSubject = new ReplaySubject<{ currentValue: DeepReadonly<S>; oldValue: DeepReadonly<S> }>(1);
  protected oldestValue: any = null;
  protected pathMap: WeakMap<any, { parent: any; key: number | string | null }>;
  protected ymmutableMap: WeakMap<any, Ymmutable<any>>;
  protected undoManager?: YMultiDocUndoManager;
  protected flushSubject = new Subject<void>();

  change = this.changeSubject.asObservable().pipe(
    debounce((value) => {
      if (this.oldestValue === null) {
        this.oldestValue = value.oldValue;
      }
      return new Observable<void>((subscriber) => {
        const timeout = setTimeout(() => {
          value.oldValue = this.oldestValue;
          this.oldestValue = null;
          subscriber.next();
          subscriber.complete();
        }, 0);
        return () => {
          clearTimeout(timeout);
        };
      });
    })
  );

  constructor(
    {
      debounceDuration = 2000,
      pathMap = new WeakMap<any, { parent: any, key: number | string | null }>(),
      ymmutableMap = new WeakMap<any, Ymmutable<any>>(),
      undoManager
    }: YmmutableConstructorOptions = {}
  ) {
    this.pathMap = pathMap;
    this.ymmutableMap = ymmutableMap;
    const yRootMap = this.doc.getMap();

    // Initialize the immutable object by cloning the root map
    this.immutable = {} as DeepReadonly<S>;

    this.proxy = new OperationsRecorderProxy({} as any);
    const opCompressor = new OperationsCompressor();
    const opApplierJson = new OperationsApplierJson(pathMap);
    const opApplierYjs = new OperationsApplierYjs();
    this.proxy.operations.subscribe((op) => {
      if (this.destroyed) {
        return;
      }
      opCompressor.addOperation(op);
      const oldValue = this.immutable;
      this.immutable = opApplierJson.applyOperations(this.immutable, [op]);
      this.pathMap.set(this.immutable, { parent: null, key: null });
      this.ymmutableMap.set(this.immutable, this);
      this.changeSubject.next({ currentValue: this.immutable, oldValue });
    });
    merge(this.debounceSubject.pipe(debounceTime(debounceDuration)), this.flushSubject).subscribe(() => {
      this.isPending = false;
      if (this.destroyed) {
        return;
      }
      if (opCompressor.spliceOperations.length + opCompressor.setOperations.length > 0) {
        this.doc.transact(() => {
          opApplierYjs.applyOperations(yRootMap, opCompressor.spliceOperations);
          opApplierYjs.applyOperations(yRootMap, opCompressor.setOperations);
        }, this);
        opCompressor.spliceOperations = [];
        opCompressor.setOperations = [];
      }
      if (this.pendingUpdates.length > 0) {
        this.applyUpdates(this.pendingUpdates);
        this.pendingUpdates = [];
      }
    });

    const handler = this.createHandle();

    yRootMap.observeDeep(handler);

    if (undoManager) {
      undoManager.addToScope(yRootMap);
      undoManager.addTrackedOrigin(this);
      this.undoManager = undoManager
    }


    this.handle = handler;

    this.doc.on('updateV2', (update: Uint8Array, origin: any) => {
      if (this.destroyed) {
        return;
      }
      if (origin !== this.remoteReference) {
        this._onUpdate.next(update);
      }
    });
  }

  protected clone(obj: any): any {
    if (obj instanceof Y.Array) {
      const arr = [];
      for (let i = 0; i < obj.length; i++) {
        const item = this.clone(obj.get(i));
        if (typeof item === 'object' && item !== null) {
          this.pathMap.set(item, { parent: arr, key: i });
        }
        arr.push(item);
      }
      return arr;
    } else if (obj instanceof Y.Map) {
      const newObj: any = {};
      for (const [key, value] of obj.entries()) {
        newObj[key] = this.clone(value);
        if (typeof newObj[key] === 'object' && newObj[key] !== null) {
          this.pathMap.set(newObj[key], { parent: newObj, key });
        }
      }
      return newObj;
    } else if (obj instanceof Uint8Array) {
      const type = obj[0];
      if (type === 0) {
        return obj.slice(1);
      } else if (type === 1) {
        const data = new Uint8Array(obj.slice(1));
        return ID.from(data);
      }
    }
    if (Array.isArray(obj)) {
      const arr = [];
      for (let i = 0; i < obj.length; i++) {
        const item = this.clone(obj[i]);
        if (typeof item === 'object' && item !== null) {
          this.pathMap.set(item, { parent: arr, key: i });
        }
        arr.push(item);
      }
      return arr;
    }
    if (typeof obj === 'object' && obj !== null && obj.constructor === Object) {
      const newObj: any = {};
      for (const key of Object.keys(obj)) {
        newObj[key] = this.clone(obj[key]);
        if (typeof newObj[key] === 'object' && newObj[key] !== null) {
          this.pathMap.set(newObj[key], { parent: newObj, key });
        }
      }
      return newObj;
    }
    return obj;
  }

  public flush() {
    this.flushSubject.next();
  }

  // Method to create a handler for observeDeep
  private createHandle() {
    return (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      if (transaction.origin === this) {
        return;
      }
      const oldValue = this.immutable;
      const newValue = { ...(this.immutable as any) };
      let hasImmutableChanges = false;
      for (const event of events) {
        if (!(event instanceof Y.YArrayEvent || event instanceof Y.YMapEvent)) {
          continue;
        }
        hasImmutableChanges = true;
        let v: any = newValue;
        for (const p of event.path) {
          if (Array.isArray(v[p])) {
            v[p] = [...v[p]];
          } else if (typeof v[p] === 'object' && v[p] !== null && !(v[p] instanceof Uint8Array)) {
            v[p] = { ...v[p] };
          }
          this.pathMap.set(v[p], { parent: v, key: p });
          v = v[p];
        }
        if (event instanceof Y.YArrayEvent) {
          let index = 0;
          for (const d of event.delta) {
            if (d.retain) {
              index += d.retain;
            }
            if (d.delete) {
              v.splice(index, d.delete);
            }
            if (d.insert) {
              const content = this.clone(d.insert) as any[];
              for (let i = 0; i < content.length; i++) {
                if (typeof content[i] === 'object' && content[i] !== null) {
                  this.pathMap.set(content[i], { parent: v, key: index + i });
                }
              }
              v.splice(index, 0, ...content);
              index += content.length;
            }
          }
        } else if (event instanceof Y.YMapEvent) {
          for (const [key2, value] of event.keys) {
            if (value.action === 'delete') {
              delete v[key2];
            } else {
              v[key2] = this.clone(event.target.get(key2));
              if (typeof v[key2] === 'object' && v[key2] !== null) {
                this.pathMap.set(v[key2], { parent: v, key: key2 });
              }
            }
          }
        }
      }
      if (!hasImmutableChanges) {
        return;
      }
      this.immutable = newValue;
      this.pathMap.set(this.immutable, { parent: null, key: null });
      this.ymmutableMap.set(this.immutable, this);
      this.proxy.setObject(this.immutable as any);
      this.changeSubject.next({ currentValue: this.immutable, oldValue });
    };
  }

  mutate(callback: (d: S) => void) {
    if (this.destroyed) {
      return;
    }
    this.debounceSubject.next();
    this.isPending = true;
    this.proxy.abstractTypeFound = false;
    callback(this.proxy.proxy);
    if (this.proxy.abstractTypeFound) {
      this.flush();
    }
  }

  setRoot(data: S) {
    this.mutate((d) => {
      for (const key in data) {
        d[key] = data[key];
      }
    });
  }
  applyUpdates(updates: Uint8Array[]): void {
    if (this.isPending) {
      this.pendingUpdates.push(...updates);
      return;
    }
    Y.transact(this.doc, () => {
      updates.forEach((update) => {
        Y.applyUpdateV2(this.doc, update);
      });
    }, this.remoteReference);
  }
  getStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }
  encodeState(stateVector?: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdateV2(this.doc, stateVector);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    const yRootMap = this.doc.getMap();
    if (this.undoManager) {
      this.undoManager.removeTrackedOrigin(this);
    }
    this.flushSubject.complete();
    this.changeSubject.complete();
    this._onUpdate.complete();
    yRootMap.unobserveDeep(this.handle);
    this.doc.destroy();
  }
}