import { OperationsApplier } from "./types";
import * as Y from 'yjs';
import { Operation, spliceOperation } from "./types";
import { ID } from "@csbenjamin/common";

type yTypes = Y.Map<any> | Y.Array<any>;

export class OperationsApplierYjs implements OperationsApplier {
    public applyOperations<T extends Y.Map<any>>(map: T, operations: Operation[]): T {
        for (const op of operations) {
            this.applyOperation(map, op);
        }
        return map;
    }

    private applyOperation(map: Y.Map<any>, op: Operation): void {
        const path = op.path;
        const operation = op.operation;

        let target = this.getOrCreateYjsTypeAtPath(map, path);
        const key = path[path.length - 1];

        if (operation === 'set') {
            const value = op.value;
            this.setYjsValue(target, key, value);
        } else {
            target = this.getOrCreateYjsChild(target, key, true);
            if (target instanceof Y.Array) {
                this.applySpliceMethod(target, op);
            } else {
                throw new Error(`O alvo não é um Y.Array`);
            }
        }
    }

    private getOrCreateYjsTypeAtPath(doc: Y.Map<any>, path: Array<string | number>): yTypes {
        let current: yTypes = doc;

        for (let index = 0; index < path.length - 1; index++) {
            const key = path[index];
            const nextKey = path[index + 1];
            const isNextKeyNumber = typeof nextKey === 'number';
            try {
                current = this.getOrCreateYjsChild(current, key, isNextKeyNumber);
            } catch (e: any) {
                throw new Error(`${e.message}, path: ${path.slice(0, index + 1).join('.')}`);
            }
        }

        return current;
    }
    private getOrCreateYjsChild(current: yTypes, key: string | number, isNextKeyNumber: boolean): yTypes {
        if (current instanceof Y.Map && typeof key === 'string') {
            if (!current.has(key)) {
                current.set(key, isNextKeyNumber ? new Y.Array() : new Y.Map());
            }
            return current.get(key);
        } else if (current instanceof Y.Array && typeof key === 'number') {
            if (current.length > key) {
                return current.get(key);
            } else {
                throw new Error(`array key is out of range`);
            }
        } else {
            throw new Error(`Tipo de chave inválido no caminho na chave ${key.toString()}`);
        }
    }

    private setYjsValue(target: yTypes, key: string | number, value: any): void {
        if (target instanceof Y.Map && typeof key === 'string') {
            target.set(key as string, this.convertValueToYjsFormat(value));
        } else if (target instanceof Y.Array && typeof key === 'number') {
            const index = key as number;
            if (target.length > index) {
                target.delete(index, 1);
            }
            target.insert(index, [this.convertValueToYjsFormat(value)]);
        } else {
            throw new Error(`Tipo de chave inválido na chave ${key.toString()}`);
        }
    }

    private applySpliceMethod(target: Y.Array<any>, op: spliceOperation): void {
        if (op.operation === 'insert') {
            target.insert(op.position, op.items.map((v: any) => this.convertValueToYjsFormat(v)));
        } else {
            target.delete(op.position, op.count);
        }
    }

    private convertValueToYjsFormat(value: any): any {
        if ((value instanceof Function) || (typeof value === 'symbol')) {
            throw new Error(`Não é possível converter funções ou símbolos para Y.Doc`);
        } else if (Array.isArray(value)) {
            const yarray = new Y.Array();
            yarray.insert(0, value.map(v => this.convertValueToYjsFormat(v)));
            return yarray;
        } else if (typeof value === 'object' && value !== null && value.constructor === Object) {
            const ymap = new Y.Map();
            for (const [k, v] of Object.entries(value)) {
                if (v !== undefined) { // Ignoramos propriedades com valor undefined
                    ymap.set(k, this.convertValueToYjsFormat(v));
                }
            }
            return ymap;
        } else if (value instanceof ID) {
            const arr = new Uint8Array(value.data.byteLength + 1);
            arr[0] = 1;
            arr.set(value.data, 1);
            return arr;
        } else if (value instanceof Uint8Array) {
            const arr = new Uint8Array(value.byteLength + 1);
            arr[0] = 0;
            arr.set(value, 1);
            return arr;
        }
        else {
            return value;
        }
    }
}