import { Subject } from 'rxjs';
import { Operation, OperationsRecorderProxyType } from './types';

export class OperationsRecorderProxy<T extends object> implements OperationsRecorderProxyType<T> {
    public proxy: T;
    private initialObject: T;
    private _operations = new Subject<Operation>();
    public operations = this._operations.asObservable();
    private proxyCache: WeakMap<object, any>;

    constructor(initialObject: T) {
        // Faz uma cópia profunda para evitar mutações no objeto original
        this.initialObject = this.deepClone(initialObject);
        this.proxyCache = new WeakMap();
        this.proxy = this.createProxy([], this.initialObject);
    }

    setObject(obj: T) {
        this.initialObject = this.deepClone(obj);
        this.proxy = this.createProxy([], this.initialObject);
    }

    private deepClone(obj: any): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (obj instanceof Uint8Array) {
            return new Uint8Array(obj);
        }
        if (obj.__isProxy) {
            return this.deepClone(obj.__target);
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        if (obj.constructor !== Object) {
            // Não clona objetos que não são literalmente Object
            return obj;
        }
        const clonedObj: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clonedObj[key] = this.deepClone(obj[key]);
            }
        }
        return clonedObj;
    }

    private createProxy(path: Array<string | number>, target: any): any {
        if (typeof target !== 'object' || target === null) {
            return target;
        }

        // Verifica se já temos um proxy para este alvo
        if (this.proxyCache.has(target)) {
            return this.proxyCache.get(target);
        }

        const handler: ProxyHandler<any> = {
            get: (obj, prop) => {
                if (prop === '__isProxy') {
                    return true;
                }
                if (prop === '__target') {
                    return target;
                }

                const value = obj[prop];

                // Se for um objeto ou array, cria um proxy recursivamente
                if (Array.isArray(value) || (typeof value === 'object' && value !== null && value.constructor === Object)) {
                    const propKey = Array.isArray(obj) && !isNaN(Number(prop)) ? Number(prop) : prop;
                    const newPath = path.concat(propKey as string | number);
                    return this.createProxy(newPath, value);
                }

                // Intercepta métodos de array
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
                            const itensToAdd = spliceArgs.slice(2);
                            if (itensToAdd.length > 0) {
                                for (let i = 0; i < itensToAdd.length; i++) {
                                    let obj = itensToAdd[i] && itensToAdd[i].__target ? itensToAdd[i].__target : itensToAdd[i];
                                    spliceArgs[i + 2] = this.deepClone(obj);
                                }
                            }
                            let result: any = obj.splice.apply(obj, spliceArgs as any);
                            const [start, deleteCount = 0, ...items] = spliceArgs;
                            if (deleteCount > 0) {
                                this._operations.next({ operation: 'delete', path, position: start, count: deleteCount });
                            }
                            if (items.length > 0) {
                                this._operations.next({ operation: 'insert', path, position: start, items });
                            }
                            if (prop === 'pop' || prop === 'shift') {
                                result = result[0];
                            } else if (prop === 'push' || prop === 'unshift') {
                                result = obj.length;
                            }
                            return result;
                        };
                    }
                }

                return value;
            },
            set: (obj, prop, value) => {
                value = this.deepClone(value);

                if (prop === 'length' && Array.isArray(obj)) {
                    if (value < obj.length) {
                        const deleteOperation: Operation = { operation: 'delete', path, position: value, count: obj.length - value };
                        this._operations.next(deleteOperation);
                        return true;
                    }
                    throw new Error('Should not use length property to increase the array size');

                }

                const propKey = Array.isArray(obj) && !isNaN(Number(prop)) ? Number(prop) : prop;
                if (typeof propKey === 'number' && Array.isArray(obj) && propKey >= obj.length) {
                    throw new Error('Key not found');
                }
                obj[propKey] = value;
                const newPath = path.concat(propKey as string | number);
                this._operations.next({ operation: 'set', path: newPath, value: this.deepClone(value) });
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