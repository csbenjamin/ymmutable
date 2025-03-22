import { Subject } from 'rxjs';
import { Operation, OperationsRecorderProxyType } from './types';
import { AbstractType } from 'yjs';
import { YMMUTABLE_ID } from './utils';

export class OperationsRecorderProxy<T extends object> implements OperationsRecorderProxyType<T> {
    public proxy: T;
    private initialObject: T;
    private _operations = new Subject<Operation>();
    public operations = this._operations.asObservable();
    private proxyCache: WeakMap<object, any>;
    public abstractTypeFound = false;
    private idToPathMap: Map<symbol, Array<string | number>> = new Map(); // Mapa de IDs para paths, preenchido sob demanda

    constructor(initialObject: T) {
        // Faz uma cópia profunda para evitar mutações no objeto original
        this.initialObject = this.deepClone(initialObject, true);
        this.proxyCache = new WeakMap();
        this.proxy = this.createProxy([], this.initialObject);
    }

    setObject(obj: T) {
        this.initialObject = this.deepClone(obj, true);
        this.proxy = this.createProxy([], this.initialObject);
        this.idToPathMap.clear();
    }

    private deepClone(obj: any, preserveId: boolean): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (obj instanceof Uint8Array) {
            return new Uint8Array(obj);
        }
        if (obj.__isProxy) {
            return this.deepClone(obj.__target, preserveId);
        }
        if (Array.isArray(obj)) {
            const id = (preserveId && (obj as any)[YMMUTABLE_ID]) || Symbol();
            return Object.defineProperty(
                obj.map(item => this.deepClone(item, preserveId)),
                YMMUTABLE_ID,
                { value: id, enumerable: false, configurable: false, writable: false }
            );
        }
        if (obj instanceof AbstractType) {
            this.abstractTypeFound = true;
        }
        if (obj.constructor !== Object) {
            // Não clona objetos que não são literalmente Object
            return obj;
        }
        const clonedObj: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clonedObj[key] = this.deepClone(obj[key], preserveId);
            }
        }
        const id = (preserveId && (obj as any)[YMMUTABLE_ID]) || Symbol();
        return Object.defineProperty(clonedObj, YMMUTABLE_ID, {
            value: id,
            enumerable: false,
            configurable: false,
            writable: false
        });
    }

    // Atualiza o mapa após um splice apenas para os proxies já criados
    private updateIdToPathMapAfterSplice(
        path: Array<string | number>,
        start: number,
        deleteCount: number,
        insertedItems: any[]
    ) {
        const arrayPath = path.join('.');
        const affectedEntries = Array.from(this.idToPathMap.entries())
            .filter(([_, p]) => p.join('.').startsWith(arrayPath) && p.length > path.length)
            .map(([id, p]) => ({ id, index: Number(p[path.length]), path: p }));

        affectedEntries.forEach(({ id, index, path: oldPath }) => {
            if (index >= start + deleteCount) {
                // Elementos deslocados após a inserção/remoção
                const newIndex = index - deleteCount + insertedItems.length;
                const newPath = [...path, newIndex, ...oldPath.slice(path.length + 1)];
                this.idToPathMap.set(id, newPath);
            } else if (index >= start && index < start + deleteCount) {
                // Elementos removidos
                this.idToPathMap.delete(id);
            }
        });
    }

    private createProxy(path: Array<string | number>, target: any): any {
        if (typeof target !== 'object' || target === null) {
            return target;
        }

        // Verifica se já temos um proxy para este alvo
        if (this.proxyCache.has(target)) {
            return this.proxyCache.get(target);
        }

        // Registra o path no mapa quando o proxy é criado
        if (target[YMMUTABLE_ID]) {
            this.idToPathMap.set(target[YMMUTABLE_ID], [...path]);
        }

        const handler: ProxyHandler<any> = {
            get: (obj, prop) => {
                if (prop === '__isProxy') {
                    return true;
                }
                if (prop === '__target') {
                    return target;
                }
                if (prop === YMMUTABLE_ID) {
                    return obj[YMMUTABLE_ID];
                }

                const value = obj[prop];

                if (
                    Array.isArray(value) ||
                    (typeof value === 'object' && value !== null && value.constructor === Object)
                ) {
                    const propKey = Array.isArray(obj) && !isNaN(Number(prop)) ? Number(prop) : prop;
                    const newPath = path.concat(propKey as string | number);
                    return this.createProxy(newPath, value);
                }

                if (typeof value === 'function' && Array.isArray(obj)) {
                    const arrayMethods = new Set(['push', 'pop', 'shift', 'unshift', 'splice']);
                    if (arrayMethods.has(prop as string)) {
                        return (...args: any[]) => {

                            let spliceArgs = args;
                            if (prop === 'push') {
                                // transform the push operation into a splice operation
                                const length = obj.length;
                                spliceArgs = [length, 0, ...args];
                            } else if (prop === 'pop') {
                                // transform the pop operation into a splice operation
                                const length = obj.length;
                                spliceArgs = [length - 1, 1];
                            } else if (prop === 'shift') {
                                // transform the shift operation into a splice operation
                                spliceArgs = [0, 1];
                            } else if (prop === 'unshift') {
                                // transform the unshift operation into a splice operation
                                spliceArgs = [0, 0, ...args];
                            }
                            for (let i = 2; i < spliceArgs.length; i++) {
                                spliceArgs[i] = this.deepClone(spliceArgs[i], false);
                            }

                            const result = obj.splice.apply(obj, spliceArgs as any);
                            const [start, deleteCount = 0, ...items] = spliceArgs;
                            // Usa o path atualizado do mapa, se disponível
                            const id = (obj as any)[YMMUTABLE_ID];
                            let newPath: Array<string | number> = path;
                            if (id && this.idToPathMap.has(id)) {
                                newPath = this.idToPathMap.get(id)!;
                            }
                            if (deleteCount > 0) {
                                this._operations.next({ operation: 'delete', path: newPath, position: start, count: deleteCount });
                            }
                            if (items.length > 0) {
                                this._operations.next({
                                    operation: 'insert',
                                    path: newPath,
                                    position: start,
                                    items: this.deepClone(items, true)
                                });
                            }
                            // Atualiza o mapa apenas para proxies já criados
                            this.updateIdToPathMapAfterSplice(path, start, deleteCount, items);

                            if (prop === 'pop' || prop === 'shift') return result[0];
                            if (prop === 'push' || prop === 'unshift') return obj.length;
                            return result;
                        };
                    }
                }
                return value;
            },
            set: (obj, prop, value) => {
                if (obj[prop] === value) return true;
                value = this.deepClone(value, false);

                if (prop === 'length' && Array.isArray(obj)) {
                    if (value < obj.length) {
                        // Usa o path atualizado do mapa, se disponível
                        const id = (obj as any)[YMMUTABLE_ID];
                        let newPath: Array<string | number> = path;
                        if (id && this.idToPathMap.has(id)) {
                            newPath = this.idToPathMap.get(id)!;
                        }
                        this._operations.next({
                            operation: 'delete',
                            path: newPath,
                            position: value,
                            count: obj.length - value
                        });
                        return true;
                    }
                    throw new Error('Should not use length property to increase the array size');
                }

                const propKey = Array.isArray(obj) && !isNaN(Number(prop)) ? Number(prop) : prop;
                if (typeof propKey === 'number' && Array.isArray(obj) && propKey >= obj.length) {
                    throw new Error('Key not found');
                }
                obj[propKey] = value;

                // Usa o path atualizado do mapa, se disponível
                const id = obj[YMMUTABLE_ID];
                let newPath: Array<string | number>;
                if (id && this.idToPathMap.has(id)) {
                    const currentPath = this.idToPathMap.get(id)!;
                    newPath = currentPath.concat(propKey as string | number);
                } else {
                    newPath = path.concat(propKey as string | number);
                }
                this._operations.next({ operation: 'set', path: newPath, value: this.deepClone(value, true) });
                return true;
            },
            deleteProperty: (obj, prop) => {
                throw new Error('Not implemented');
            }
        };

        const proxy = new Proxy(target, handler);
        this.proxyCache.set(target, proxy);
        return proxy;
    }

}