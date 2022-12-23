import {DeepReadonly} from 'ts-essentials';
import {
  AbstractType as YAbstractType,
  Array as YArray,
  Doc,
  Map as YMap,
  UndoManager,
  YArrayEvent,
  YEvent,
  YMapEvent
} from 'yjs';
import {cloneDeep, cloneDeepWith} from 'lodash';
import {debounce, Observable, Subject} from 'rxjs';

const INTERNAL_SYMBOL = Symbol('INTERNAL_SYMBOL');

function clone<T>(value: T): T {
  return cloneDeepWith(value, customizer);
  function customizer(value2: any) {
    if (!value2) {
      return value2;
    }
    if (value2.toJSON) {
      return cloneDeep(value2.toJSON());
    }
  }
}

function createHandle(key: string, _type: 'array' | 'object', result: YmmutableReturnValue<any>) {
  return function handle(events: YEvent<any>[]) {
    const oldValue = result.immutable;
    result.immutable = { ...result.immutable };
    result.immutable[key] = _type === 'array' ? [...result.immutable[key]] : { ...result.immutable[key] };
    for (const event of events) {
      let v: any = result.immutable[key];
      for (const p of event.path) {
        if (v[p] instanceof Array) {
          v[p] = [...v[p]];
        } else if (typeof v[p] === 'object' && v[p] && !(v[p] instanceof Uint8Array)) {
          v[p] = { ...v[p] };
        }
        v = v[p];
      }
      if (event instanceof YArrayEvent) {
        let index = 0;
        for (const d of event.delta) {
          if (d.retain) {
            index += d.retain;
          }
          if (d.delete) {
            v.splice(index, d.delete);
          }
          if (d.insert) {
            const content = clone(d.insert) as any[];
            v.splice(index, 0, ...content);
            index += content.length;
          }
        }
      } else if (event instanceof YMapEvent) {
        for (const [key2, value] of event.keys) {
          if (value.action === 'delete') {
            delete v[key2];
          } else {
            v[key2] = clone(event.target.get(key2));
          }
        }
      }
    }
    result.changeSubject.next({currentValue: result.immutable, oldValue});
  };
}

export function Ymmutable<S = JSONObject>(settings: settingsType<S>, doc = new Doc()): YmmutableReturn<S> {
  const handlers: any = {};
  const result = new YmmutableReturnValue<S>(doc, handlers, null, settings);
  const yTypes: any[] = [];
  for (const [key, value] of Object.entries(settings)) {
    if (value !== 'array' && value !== 'object') {
      throw new Error(`Invalid settings. Invalid value: settings.${key} = ${value}`);
    }
    const yType = value === 'array' ? doc.getArray(key) : doc.getMap(key);
    (result.immutable as any)[key] = clone(yType);
    handlers[key] = createHandle(key, value, result);
    yType.observeDeep(handlers[key]);
    yTypes.push(yType);
  }
  if (yTypes.length === 0) {
    throw new Error('Invalid settings. It is empty');
  }
  result.undoManager = new UndoManager(yTypes, {trackedOrigins: new Set([doc.clientID])});
  result.proxy = new Proxy({} as any, {
    set: () => {
      throw new Error('cannot set new elements on root doc');
    },
    get: (target, p) => {
      if (typeof p !== 'string') {
        return undefined;
        // throw new Error("get non string parameter");
      }
      switch ((settings as any)[p]) {
        case 'array':
          return yjsToProxy(doc.getArray(p));
        case 'object':
          return yjsToProxy(doc.getMap(p));
      }
      return undefined;
    },
    deleteProperty: () => {
      throw new Error('deleteProperty not available for doc');
    },
    has: (target, p) => {
      return typeof p === 'string' && doc.share.has(p);
    },
    getOwnPropertyDescriptor(target, p) {
      if ((typeof p === 'string' && doc.share.has(p)) || p === 'toJSON') {
        return {
          enumerable: true,
          configurable: true,
        };
      }
      return undefined;
    },
    ownKeys: () => {
      return Array.from(doc.share.keys());
    },
  });

  return result;
}

type settingsType<T> = {
  [K in keyof T]: T[K] extends any[]|undefined ? 'array' : T[K] extends JSONObject|undefined ? 'object' : never;
};

export interface YmmutableReturn<S> {
  readonly immutable: DeepReadonly<S>;
  readonly undoManager: UndoManager;
  readonly doc: Doc;
  mutate(callback: (d: S) => void): void;
  destroy(): void;
  change: Observable<{ currentValue: S, oldValue: S }>
}

class YmmutableReturnValue<S> implements YmmutableReturn<S>{
  public immutable: DeepReadonly<S> = {} as any;
  public undoManager: UndoManager = null as any;
  protected destroyed = false;

  changeSubject = new Subject<{ currentValue: S, oldValue: S }>()
  protected oldestValue: any = null;
  change = this.changeSubject.asObservable().pipe(debounce((value) => {
    if (this.oldestValue === null) {
      this.oldestValue = value.oldValue;
    }
    return new Observable(subscriber => {
      let timeout = setTimeout(() => {
        value.oldValue = this.oldestValue;
        this.oldestValue = null;
        subscriber.next();
      }, 0);
      return () => {
        clearTimeout(timeout);
      }
    })
  }))
  constructor(
    public doc: Doc,
    public handles: any,
    public proxy: any,
    protected setting: any
  ) {
  }
  mutate(callback: (d: S) => void) {
    if (this.destroyed) {
      return;
    }
    this.doc.transact(() => {
      callback(this.proxy);
    }, this.doc.clientID);
  }
  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const [key, value] of Object.entries(this.setting)) {
      const yType = value === 'array' ? this.doc.getArray(key) : this.doc.getMap(key);
      yType.unobserveDeep(this.handles[key]);
    }
    this.doc.destroy();
  }
}

type JSONValue = string | number | boolean | JSONObject | JSONArray | Uint8Array;

interface JSONObject {
  [x: string]: JSONValue;
}

interface JSONArray extends Array<JSONValue> {}

function valueToProxy(value: YArray<any> | YMap<any> | string | Uint8Array | boolean | number | unknown) {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof YArray) {
    return arrayToProxyArray([], value);
  } else if (value instanceof YMap) {
    return objectToProxyObject({}, value);
  } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value; // TODO
  } else if (Array.isArray(value)) {
    return arrayToProxyArray(value as any[]);
  } else if (value instanceof Uint8Array) {
    return value;
  } else if (typeof value === 'object') {
    return objectToProxyObject(value as any);
  } else {
    throw new Error('invalid');
  }
}

const yToWrappedCache = new WeakMap<YAbstractType<any> | Doc, any>();

function yjsToProxy(value: any) {
  if (value instanceof YAbstractType) {
    if (value instanceof YArray || value instanceof YMap) {
      if (!yToWrappedCache.has(value)) {
        const wrapped = valueToProxy(value);
        yToWrappedCache.set(value, wrapped);
      }
      value = yToWrappedCache.get(value);
    } else {
      throw new Error('unsupported YType');
    }
  } else if (value === null) {
    return null;
  } else if (value instanceof Uint8Array) {
    return value;
  } else if (typeof value === 'object') {
    throw new Error('Unsupported object in document');
  }
  return value;
}

function objectToProxyObject(initializer: any, map = new YMap<any>()) {
  const proxy = new Proxy({} as any, {
    set: (target, p, value) => {
      if (typeof p !== 'string') {
        throw new Error();
      }
      const wrapped = valueToProxy(value); // TODO: maybe set cache
      let valueToSet = getYjsValue(wrapped) || wrapped;

      if (wrapped instanceof YAbstractType && wrapped.parent) {
        throw new Error('Not supported: reassigning object that already occurs in the tree.');
      }
      map.set(p, valueToSet);
      return true;
    },
    get: (target, p) => {
      if (p === INTERNAL_SYMBOL) {
        return map;
      }
      if (typeof p !== 'string') {
        return Reflect.get(target, p);
        // throw new Error("get non string parameter");
      }
      let ret = map.get(p);
      ret = yjsToProxy(ret);
      return ret;
    },
    deleteProperty: (target, p) => {
      if (typeof p !== 'string') {
        throw new Error();
      }
      if (map.has(p)) {
        map.delete(p);
        return true;
      } else {
        return false;
      }
    },
    has: (target, p) => {
      return typeof p === 'string' && map.has(p);
    },
    getOwnPropertyDescriptor(target, p) {
      if (typeof p === 'string' && map.has(p)) {
        return {
          enumerable: true,
          configurable: true,
        };
      }
      return undefined;
    },
    ownKeys: () => {
      return Array.from(map.keys());
    },
  });

  yToWrappedCache.set(map, proxy);

  for (let key in initializer) {
    proxy[key] = initializer[key] as any;
  }

  return proxy;
}

function getYjsValue(object: any): Doc | YAbstractType<any> | undefined {
  if (typeof object !== 'object' || object === null) {
    return undefined;
  }
  if (object instanceof Uint8Array) {
    return undefined;
  }
  return object[INTERNAL_SYMBOL];
}

function arrayImplementation<T>(arr: YArray<T>) {
  const slice = function slice(this: any) {
    const items = arr.slice.bind(arr).apply(arr, arguments as any);
    return items.map((item) => {
      return yjsToProxy(item);
    });
  } as T[]['slice'];

  const wrapItems = function wrapItems(items: any) {
    return items.map((item: any) => {
      const wrapped = valueToProxy(item as any); // TODO
      let valueToSet = getYjsValue(wrapped) || wrapped;
      if (valueToSet instanceof YAbstractType && valueToSet.parent) {
        throw new Error('Not supported: reassigning object that already occurs in the tree.');
      }
      return valueToSet;
    });
  };

  const findIndex = function findIndex(this: any) {
    return [].findIndex.apply(slice.apply(this), arguments as any);
  } as unknown as T[]['find'];

  const ret = {
    // get length() {
    //   return arr.length;
    // },
    // set length(val: number) {
    //   throw new Error("set length of yjs array is unsupported");
    // },
    slice,
    unshift: (...items: T[]) => {
      arr.unshift(wrapItems(items));
      return (arr as any).lengthUntracked;
    },

    push: (...items: T[]) => {
      arr.push(wrapItems(items));
      return (arr as any).lengthUntracked;
    },

    insert: arr.insert.bind(arr) as YArray<T>['insert'],
    toJSON: arr.toJSON.bind(arr) as YArray<T>['toJSON'],

    forEach: function (this: any) {
      return [].forEach.apply(slice.apply(this), arguments as any);
    } as T[]['forEach'],

    every: function () {
      return [].every.apply(slice.apply(this), arguments as any);
    },
    wrapItems,

    filter: function (this: any) {
      return [].filter.apply(slice.apply(this), arguments as any);
    } as T[]['filter'],

    reduce: function (this: any) {
      return [].reduce.apply(slice.apply(this), arguments as any);
    } as T[]['reduce'],

    find: function (this: any) {
      return [].find.apply(slice.apply(this), arguments as any);
    } as T[]['find'],

    findIndex,

    some: function (this: any) {
      return [].some.apply(slice.apply(this), arguments as any);
    } as T[]['some'],

    includes: function (this: any) {
      return [].includes.apply(slice.apply(this), arguments as any);
    } as T[]['includes'],

    map: function (this: any) {
      return [].map.apply(slice.apply(this), arguments as any);
    } as T[]['map'],

    indexOf: function (this: any) {
      const arg = arguments[0];
      return findIndex.call(this, (el) => areSame(el, arg));
    } as unknown as T[]['indexOf'],

    splice: function (this: any) {
      let start = arguments[0] < 0 ? arr.length - Math.abs(arguments[0]) : arguments[0];
      let deleteCount = arguments[1];
      let items = Array.from(Array.from(arguments).slice(2));
      let deleted = slice.apply(this, [start, Number.isInteger(deleteCount) ? start + deleteCount : undefined]);
      if (arr.doc) {
        arr.doc.transact(() => {
          arr.delete(start, deleteCount);
          arr.insert(start, wrapItems(items));
        });
      } else {
        arr.delete(start, deleteCount);
        arr.insert(start, wrapItems(items));
      }
      return deleted;
    } as T[]['splice'],
    // toJSON = () => {
    //   return this.arr.toJSON() slice();
    // };
    // delete = this.arr.delete.bind(this.arr) as (Y.Array<T>)["delete"];
  };

  // this is necessary to prevent errors like "trap reported non-configurability for property 'length' which is either non-existent or configurable in the proxy target" when adding support for ownKeys and Reflect.keysx
  Object.defineProperty(ret, 'length', {
    enumerable: false,
    configurable: false,
    writable: true,
    value: (arr as any).lengthUntracked,
  });

  return ret;
}

function propertyToNumber(p: string | number | symbol) {
  if (typeof p === 'string' && p.trim().length) {
    const asNum = Number(p);
    // https://stackoverflow.com/questions/10834796/validate-that-a-string-is-a-positive-integer
    if (Number.isInteger(asNum)) {
      return asNum;
    }
  }
  return p;
}

function arrayToProxyArray<T>(initializer: T[], arr = new YArray<T>()) {
  const implementation = arrayImplementation(arr);

  const proxy = new Proxy(implementation as any, {
    set: (target, pArg, value) => {
      const p = propertyToNumber(pArg);
      if (typeof p !== 'number') {
        throw new Error();
      }
      const wrapped = valueToProxy(value as any);
      const toSet = getYjsValue(wrapped) || wrapped;
      arr.delete(p, 1);
      arr.insert(p, [toSet]);
      // implementation.splice(p, 1, value);
      // TODO map.set(p, smartValue(value));
      // throw new Error("array assignment is not implemented / supported");
      return true;
    },
    get: (target, pArg, receiver) => {
      const p = propertyToNumber(pArg);

      if (p === INTERNAL_SYMBOL) {
        return arr;
      }

      if (typeof p === 'number') {
        let ret = arr.get(p) as any;
        ret = yjsToProxy(ret);
        return ret;
      }

      if (p === Symbol.toStringTag) {
        return 'Array';
      }

      if (p === Symbol.iterator) {
        const values = arr.slice();
        return Reflect.get(values, p);
      }

      if (p === 'length') {
        return arr.length;
      }
      // forward to arrayimplementation
      return Reflect.get(target, p, receiver);
    },
    // getOwnPropertyDescriptor: (target, pArg) => {
    //   const p = propertyToNumber(pArg);
    //   if (typeof p === "number" && p < arr.length && p >= 0) {
    //     return { configurable: true, enumerable: true, value: arr.get(p) };
    //   } else {
    //     return undefined;
    //   }
    // },
    deleteProperty: (target, pArg) => {
      const p = propertyToNumber(pArg);
      if (typeof p !== 'number') {
        throw new Error();
      }
      if (p < (arr as any).lengthUntracked && p >= 0) {
        arr.delete(p);
        return true;
      } else {
        return false;
      }
    },
    has: (target, pArg) => {
      const p = propertyToNumber(pArg);
      if (typeof p !== 'number') {
        // forward to arrayimplementation
        return Reflect.has(target, p);
      }
      return p < (arr as any).lengthUntracked && p >= 0;
    },
    getOwnPropertyDescriptor(target, pArg) {
      const p = propertyToNumber(pArg);
      if (p === 'length') {
        return {
          enumerable: false,
          configurable: false,
          writable: true,
        };
      }
      if (typeof p === 'number' && p >= 0 && p < (arr as any).lengthUntracked) {
        return {
          enumerable: true,
          configurable: true,
          writable: true,
        };
      }
      return undefined;
    },
    ownKeys: () => {
      const keys: string[] = [];
      for (let i = 0; i < arr.length; i++) {
        keys.push(i + '');
      }
      keys.push('length');
      return keys;
    },
  });

  implementation.push.apply(proxy, initializer);
  return proxy;
}

function areSame(objectA: any, objectB: any) {
  if (objectA === objectB) {
    return true;
  }
  if (typeof objectA === 'object' && typeof objectB === 'object') {
    const internalA = getYjsValue(objectA);
    const internalB = getYjsValue(objectB);
    if (!internalA || !internalB) {
      // one of them doesn't have an internal value
      return false;
    }
    return internalA === internalB;
  }
  return false;
}
