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
        this.pathMap.set(result, { parent: null, key: null });

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
            obj = obj.slice();
            for (let i = 0; i < obj.length; i++) {
                obj[i] = this.deepCloneSettingMap(obj[i]);
                if (typeof obj[i] === 'object' && obj[i] !== null) {
                    this.pathMap.set(obj[i], { parent: obj, key: i });
                }
            }
            return obj;
        }
        if (typeof obj === 'object' && obj !== null) {
            obj = { ...obj };
            for (const key of Object.keys(obj)) {
                obj[key] = this.deepCloneSettingMap(obj[key]);
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    this.pathMap.set(obj[key], { parent: obj, key });
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
        let newObj;
        if (Array.isArray(obj)) {
            newObj = obj.slice();
        } else if (typeof obj === 'object' && obj !== null) {
            newObj = { ...obj };
        } else {
            throw new Error(`Cannot set property ${key} on non-object`);
        }
        newObj[key] = this.setIn(obj[key], rest, value);
        if (typeof newObj[key] === 'object' && newObj[key] !== null) {
            this.pathMap.set(newObj[key], { parent: newObj, key });
        }
        return newObj;
    }

    private applySpliceMethod(obj: any, op: spliceOperation): any {
        const array = this.getIn(obj, op.path);
        if (!Array.isArray(array)) {
            throw new Error(`Target is not an array at path ${op.path.join('.')}`);
        }
        const newArray = array.slice();
        if (op.operation === 'insert') {
            newArray.splice(op.position, 0, ...op.items);
            return this.setIn(obj, op.path, newArray);
        }
        if (op.operation === 'delete') {
            newArray.splice(op.position, op.count);
            return this.setIn(obj, op.path, newArray);
        }
    }
}