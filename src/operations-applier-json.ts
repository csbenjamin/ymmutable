import { ID } from "@csbenjamin/common";
import { OperationsApplier } from "./types";
import { Operation, spliceOperation } from "./types";

export class OperationsApplierJson implements OperationsApplier {
    constructor(protected pathMap: WeakMap<any, { parent: any; key: number | string | null }> = new WeakMap()) {
    }
    public applyOperations(obj: any, operations: Operation[]): any {
        let result = obj;

        for (const op of operations) {
            result = this.applyOperation(result, op);
        }

        return result;
    }

    private applyOperation(obj: any, op: Operation): any {
        if (op.operation === 'set') {
            return this.setIn(obj, op.path, op.value);
        }
        return this.applySpliceMethod(obj, op);
    }

    private getIn(obj: any, path: Array<string | number>): any {
        let current = obj;
        for (const key of path) {
            if (current == null) return undefined;
            current = current[key];
        }
        return current;
    }
    protected deepCloneSettingMap(obj: any): any {
        if (obj instanceof ID) {
            return obj;
        }
        if (Array.isArray(obj)) {
            const id = (obj as any)._;
            obj = obj.slice();
            Object.defineProperty(obj, '_', { value: id || {}, enumerable: false, configurable: false, writable: false });
            for (let i = 0; i < obj.length; i++) {
                obj[i] = this.deepCloneSettingMap(obj[i]);
                if (typeof obj[i] === 'object' && obj[i] !== null && obj[i]._) {
                    this.pathMap.set(obj[i]._, { parent: obj._, key: i });
                }
            }
            return obj;
        }
        if (typeof obj === 'object' && obj !== null && obj.constructor === Object) {
            const id = (obj as any)._;
            obj = { ...obj };
            Object.defineProperty(obj, '_', { value: id || {}, enumerable: false, configurable: false, writable: false });
            for (const key of Object.keys(obj)) {
                obj[key] = this.deepCloneSettingMap(obj[key]);
                if (typeof obj[key] === 'object' && obj[key] !== null && obj[key]._) {
                    this.pathMap.set(obj[key]._, { parent: obj._, key });
                }
            }
        }
        return obj;
    }

    private setIn(obj: any, path: Array<string | number>, value: any): any {
        if (path.length === 0) {
            return this.deepCloneSettingMap(value);
        }
        const [key, ...rest] = path;
        let newObj: any;
        if (Array.isArray(obj)) {
            newObj = obj.slice();
            Object.defineProperty(newObj, '_', { value: (obj as any)._, enumerable: false, configurable: false, writable: false });
        } else if (typeof obj === 'object' && obj !== null) {
            newObj = { ...obj };
            Object.defineProperty(newObj, '_', { value: obj._, enumerable: false, configurable: false, writable: false });
        } else {
            throw new Error(`Cannot set property ${key} on non-object`);
        }
        newObj[key] = this.setIn(obj[key], rest, value);
        if (typeof newObj[key] === 'object' && newObj[key] !== null && newObj[key]._) {
            this.pathMap.set(newObj[key]._, { parent: newObj._, key });
        }
        return newObj;
    }

    private applySpliceMethod(obj: any, op: spliceOperation): any {
        const array = this.getIn(obj, op.path);
        if (!Array.isArray(array)) {
            throw new Error(`Target is not an array at path ${op.path.join('.')}`);
        }
        const newArray = array.slice();
        Object.defineProperty(newArray, '_', { value: (array as any)._, enumerable: false, configurable: false, writable: false });
        if (op.operation === 'insert') {
            newArray.splice(op.position, 0, ...op.items);
            for (let i = op.position; i < newArray.length; i++) {
                if (typeof newArray[i] === 'object' && newArray[i] !== null && newArray[i]._) {
                    this.pathMap.set(newArray[i]._, { parent: (newArray as any)._, key: i });
                }
            }
            return this.setIn(obj, op.path, newArray);
        }
        if (op.operation === 'delete') {
            const deleted = newArray.splice(op.position, op.count);
            for (const item of deleted) {
                if (typeof item === 'object' && item !== null && item._) {
                    this.pathMap.delete(item._);
                }
            }
            for (let i = op.position; i < newArray.length; i++) {
                if (typeof newArray[i] === 'object' && newArray[i] !== null && newArray[i]._) {
                    this.pathMap.set(newArray[i]._, { parent: (newArray as any)._, key: i });
                }
            }
            return this.setIn(obj, op.path, newArray);
        }
    }
}