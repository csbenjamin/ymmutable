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
    private idToPathMap: Map<object, Array<string | number>> = new Map(); // Mapa de IDs para paths, preenchido sob demanda

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
            const id = (preserveId && (obj as any)[YMMUTABLE_ID]) || {};
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
        const id = (preserveId && (obj as any)[YMMUTABLE_ID]) || {};
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

    private toIntegerOrInfinity(value: any): number {
        const numberValue = Number(value);
        if (Number.isNaN(numberValue) || numberValue === 0) {
            return 0;
        }
        if (!Number.isFinite(numberValue)) {
            return numberValue;
        }
        return numberValue < 0 ? Math.ceil(numberValue) : Math.floor(numberValue);
    }

    private normalizeSpliceArgs(length: number, args: any[]): { start: number; deleteCount: number; items: any[] } {
        const relativeStart = args.length > 0 ? this.toIntegerOrInfinity(args[0]) : 0;
        const start = relativeStart === -Infinity
            ? 0
            : relativeStart < 0
                ? Math.max(length + relativeStart, 0)
                : Math.min(relativeStart, length);

        let deleteCount: number;
        if (args.length === 0) {
            deleteCount = 0;
        } else if (args.length === 1) {
            deleteCount = length - start;
        } else {
            deleteCount = Math.min(Math.max(this.toIntegerOrInfinity(args[1]), 0), length - start);
        }

        return {
            start,
            deleteCount,
            items: args.slice(2),
        };
    }

    private getCurrentPath(obj: any, fallbackPath: Array<string | number>): Array<string | number> {
        const id = obj[YMMUTABLE_ID];
        if (id && this.idToPathMap.has(id)) {
            return this.idToPathMap.get(id)!;
        }
        return fallbackPath;
    }

    private applyArraySplice(obj: any[], path: Array<string | number>, args: any[]) {
        const { start, deleteCount, items: rawItems } = this.normalizeSpliceArgs(obj.length, args);
        const items = rawItems.map(item => this.deepClone(item, false));
        const result = obj.splice(start, deleteCount, ...items);
        const currentPath = this.getCurrentPath(obj, path);

        if (deleteCount > 0) {
            this._operations.next({ operation: 'delete', path: currentPath, position: start, count: deleteCount });
        }
        if (items.length > 0) {
            this._operations.next({
                operation: 'insert',
                path: currentPath,
                position: start,
                // temos que fazer um novo clone, para que novas operações aqui no proxy não altere
                items: this.deepClone(items, true)
            });
        }
        this.updateIdToPathMapAfterSplice(currentPath, start, deleteCount, items);

        return result;
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
                    if (Array.isArray(value) || typeof value === "object" && value !== null && value.constructor === Object) {
                        // --- Tenta obter o caminho ATUALIZADO do PAI ---
                        const parentId = obj[YMMUTABLE_ID];
                        // Usa o caminho do mapa se confiável, senão usa o 'path' capturado (que pode estar obsoleto)
                        const currentParentPath = (parentId && this.idToPathMap.get(parentId)) || path;
                        // ---------------------------------------------
                        const propKey = Array.isArray(obj) && !isNaN(Number(prop)) ? Number(prop) : prop;
                        const newPath = currentParentPath.concat(propKey as string | number);
                        return this.createProxy(newPath, value);
                    }
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
                            const result = this.applyArraySplice(obj, path, spliceArgs);

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
                        this.applyArraySplice(obj, path, [value, obj.length - value]);
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