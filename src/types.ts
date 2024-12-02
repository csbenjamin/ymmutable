import { Observable } from "rxjs";

export interface DeleteOperation {
    operation: 'delete';
    path: (string | number)[];
    position: number;
    count: number;
}
export interface InsertOperation {
    operation: 'insert';
    path: (string | number)[];
    position: number;
    items: any[];
}
export type spliceOperation = DeleteOperation | InsertOperation;

export interface setOperation {
    operation: 'set';
    path: (string | number)[];
    value: any;
}

export type Operation = spliceOperation | setOperation;

export interface OperationsApplier {
    applyOperations(target: any, operations: Operation[]): any;
}

export interface OperationsRecorderProxyType<T extends object> {
    proxy: T;
    operations: Observable<Operation>;
}

export interface YDocType {
    onUpdate: Observable<Uint8Array>;
    applyUpdates(updates: Uint8Array[]): void;
    getStateVector(): Uint8Array;
    encodeState(stateVector?: Uint8Array): Uint8Array;
}


