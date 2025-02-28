import { ID } from "@csbenjamin/common";
import { OperationsApplier } from "./types";
import { Operation, spliceOperation } from "./types";
import { YMMUTABLE_ID } from "./utils";

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

    private arrayCopy<T = any>(arr: T[]): T[] {
        return Object.defineProperty([...arr], YMMUTABLE_ID, { value: (arr as any)[YMMUTABLE_ID] || Symbol(), enumerable: false, configurable: false, writable: false });
    }
    private objCopy<T = any>(obj: T): T {
        return Object.defineProperty({ ...obj }, YMMUTABLE_ID, { value: (obj as any)[YMMUTABLE_ID] || Symbol(), enumerable: false, configurable: false, writable: false });
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
            obj = this.arrayCopy(obj);
            for (let i = 0; i < obj.length; i++) {
                obj[i] = this.deepCloneSettingMap(obj[i]);
                if (typeof obj[i] === 'object' && obj[i] !== null && obj[i][YMMUTABLE_ID]) {
                    this.pathMap.set(obj[i][YMMUTABLE_ID], { parent: obj[YMMUTABLE_ID], key: i });
                }
            }
            return obj;
        }
        if (typeof obj === 'object' && obj !== null && obj.constructor === Object) {
            obj = this.objCopy(obj);
            for (const key of Object.keys(obj)) {
                obj[key] = this.deepCloneSettingMap(obj[key]);
                if (typeof obj[key] === 'object' && obj[key] !== null && obj[key][YMMUTABLE_ID]) {
                    this.pathMap.set(obj[key][YMMUTABLE_ID], { parent: obj[YMMUTABLE_ID], key });
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
            newObj = this.arrayCopy(obj);
        } else if (typeof obj === 'object' && obj !== null) {
            newObj = this.objCopy(obj);
        } else {
            throw new Error(`Cannot set property ${key} on non-object`);
        }
        newObj[key] = this.setIn(obj[key], rest, value);
        if (typeof newObj[key] === 'object' && newObj[key] !== null && newObj[key][YMMUTABLE_ID]) {
            this.pathMap.set(newObj[key][YMMUTABLE_ID], { parent: newObj[YMMUTABLE_ID], key });
        }
        return newObj;
    }

    private applySpliceMethod(obj: any, op: spliceOperation): any {
        const array = this.getIn(obj, op.path);
        if (!Array.isArray(array)) {
            throw new Error(`Target is not an array at path ${op.path.join('.')}`);
        }
        const newArray = this.arrayCopy(array);
        if (op.operation === 'insert') {
            newArray.splice(op.position, 0, ...op.items);
            for (let i = op.position; i < newArray.length; i++) {
                if (typeof newArray[i] === 'object' && newArray[i] !== null && newArray[i][YMMUTABLE_ID]) {
                    this.pathMap.set(newArray[i][YMMUTABLE_ID], { parent: (newArray as any)[YMMUTABLE_ID], key: i });
                }
            }
            return this.setIn(obj, op.path, newArray);
        }
        if (op.operation === 'delete') {
            const deleted = newArray.splice(op.position, op.count);
            for (const item of deleted) {
                if (typeof item === 'object' && item !== null && item[YMMUTABLE_ID]) {
                    this.pathMap.delete(item[YMMUTABLE_ID]);
                }
            }
            for (let i = op.position; i < newArray.length; i++) {
                if (typeof newArray[i] === 'object' && newArray[i] !== null && newArray[i][YMMUTABLE_ID]) {
                    this.pathMap.set(newArray[i][YMMUTABLE_ID], { parent: (newArray as any)[YMMUTABLE_ID], key: i });
                }
            }
            return this.setIn(obj, op.path, newArray);
        }
    }
}