import { OperationsRecorderProxy, Operation } from '..';

describe('OperationsRecorderProxy', () => {
    let initialObject: any;
    let objectProxy: OperationsRecorderProxy<any>;
    let operations: Operation[];

    beforeEach(() => {
        initialObject = { a: 1, b: { c: 2 }, d: [3, 4], f: [4, 3], e: [{ f: 5 }], g: [{ id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 2 }] };
        objectProxy = new OperationsRecorderProxy(initialObject);
        operations = [];
        objectProxy.operations.subscribe(op => operations.push(op));
    });

    it('should initialize correctly', () => {
        expect(objectProxy).toBeDefined();
        expect(objectProxy.proxy).toBeDefined();
    });

    it('should deep clone an object', () => {
        const cloned = objectProxy['deepClone'](initialObject);
        expect(cloned).toEqual(initialObject);
        expect(cloned).not.toBe(initialObject);
        expect(cloned.b).not.toBe(initialObject.b);
        expect(cloned.d).not.toBe(initialObject.d);
    });

    it('should create a proxy for an object', () => {
        const proxy = objectProxy['createProxy']([], initialObject);
        expect(proxy).toBeDefined();
        expect(proxy.a).toBe(1);
        expect(proxy.b.c).toBe(2);
        expect(proxy.d[0]).toBe(3);
    });

    it('should track set operations', () => {
        objectProxy.proxy.a = 10;
        expect(operations).toEqual([{ operation: 'set', path: ['a'], value: 10 }]);
    });

    it('should track adding a new property', () => {
        objectProxy.proxy.newProp = 'new';
        expect(operations).toEqual([{ operation: 'set', path: ['newProp'], value: 'new' }]);
    });

    it('should track adding a new nested property', () => {
        objectProxy.proxy.b.newNestedProp = 'nestedNew';
        expect(operations).toEqual([{ operation: 'set', path: ['b', 'newNestedProp'], value: 'nestedNew' }]);
    });

    it('should track setting property to undefined', () => {
        objectProxy.proxy.a = undefined;
        expect(operations).toEqual([{ operation: 'set', path: ['a'], value: undefined }]);
    });

    it('should track setting property to null', () => {
        objectProxy.proxy.a = null;
        expect(operations).toEqual([{ operation: 'set', path: ['a'], value: null }]);
    });

    it('should track assigning an array to a property', () => {
        objectProxy.proxy.newArray = [1, 2, 3];
        expect(operations).toEqual([{ operation: 'set', path: ['newArray'], value: [1, 2, 3] }]);
    });

    it('should track assigning an object to a property', () => {
        objectProxy.proxy.newObject = { x: 1 };
        expect(operations).toEqual([{ operation: 'set', path: ['newObject'], value: { x: 1 } }]);
    });

    it('should track setting property on nested array element', () => {
        objectProxy.proxy.e[0].f = 10;
        expect(operations).toEqual([{ operation: 'set', path: ['e', 0, 'f'], value: 10 }]);
    });

    it('should track array push operations', () => {
        objectProxy.proxy.d.push(5);
        expect(operations).toEqual([{ operation: 'insert', path: ['d'], position: 2, items: [5] }]);
    });

    it('should track array pop operations', () => {
        const poppedValue = objectProxy.proxy.d.pop();
        expect(poppedValue).toBe(4);
        expect(operations).toEqual([{ operation: 'delete', path: ['d'], position: 1, count: 1 }]);
    });

    it('should track array shift operations', () => {
        const shiftedValue = objectProxy.proxy.d.shift();
        expect(shiftedValue).toBe(3);
        expect(operations).toEqual([{ operation: 'delete', path: ['d'], position: 0, count: 1 }]);
    });

    it('should track array unshift operations', () => {
        objectProxy.proxy.d.unshift(2);
        expect(operations).toEqual([{ operation: 'insert', path: ['d'], position: 0, items: [2] }]);
    });

    it('should track array splice operations', () => {
        objectProxy.proxy.d.splice(1, 1, 5, 6);
        expect(operations).toEqual([
            { operation: 'delete', path: ['d'], position: 1, count: 1 },
            { operation: 'insert', path: ['d'], position: 1, items: [5, 6] }
        ]);
    });

    it('should track array splice operations that delete multiple elements', () => {
        objectProxy.proxy.d.splice(0, 2);
        expect(operations).toEqual([
            { operation: 'delete', path: ['d'], position: 0, count: 2 }
        ]);
    });

    it('should track array splice operations that replace elements', () => {
        objectProxy.proxy.d.splice(0, 2, 10, 20);
        expect(operations).toEqual([
            { operation: 'delete', path: ['d'], position: 0, count: 2 },
            { operation: 'insert', path: ['d'], position: 0, items: [10, 20] }
        ]);
    });

    it('should track setting an array and then pushing an element', () => {
        objectProxy.proxy.d = [1, 2, 3, 4, 5];
        objectProxy.proxy.d.push(6);
        expect(operations).toEqual([
            { operation: 'set', path: ['d'], value: [1, 2, 3, 4, 5] },
            { operation: 'insert', path: ['d'], position: 5, items: [6] }
        ]);
    });

    it('should throw an error when setting array element beyond current length', () => {
        expect(() => {
            objectProxy.proxy.d[2] = 10;
        }).toThrow('Key not found');
    });

    it('should generate splice operations for array length property less than current size', () => {
        objectProxy.proxy.d.length = 1;
        expect(operations).toEqual([{ operation: 'delete', path: ['d'], position: 1, count: 1 }]);
    });

    it('should throw an error when setting array length property greater than current size', () => {
        expect(() => {
            objectProxy.proxy.d.length = 5;
        }).toThrow('Should not use length property to increase the array size');
    });

    it('should create a proxy for nested arrays', () => {
        const proxy = objectProxy['createProxy']([], initialObject);
        expect(proxy.e[0].f).toBe(5);
    });

    it('should not track non-intercepted array methods like forEach', () => {
        objectProxy.proxy.d.forEach(() => { });
        expect(operations).toEqual([]);
    });

    it('should track array reverse operations', () => {
        objectProxy.proxy.d.reverse();
        expect(operations).toEqual([
            { operation: 'set', path: ['d', 0], value: 4 },
            { operation: 'set', path: ['d', 1], value: 3 }
        ]);
    });

    it('should track array sort operations', () => {
        objectProxy.proxy.f.sort();
        console.log(operations);
        expect(operations).toEqual([
            { operation: 'set', path: ['f', 0], value: 3 },
            { operation: 'set', path: ['f', 1], value: 4 }
        ]);
    });

    it('should work with sort method with a compare function', () => {
        objectProxy.proxy.g.sort((a: any, b: any) => a.id - b.id);
        expect(operations).toEqual([
            { operation: 'set', path: ['g', 0], value: { id: 1 } },
            { operation: 'set', path: ['g', 1], value: { id: 2 } },
            { operation: 'set', path: ['g', 2], value: { id: 3 } },
            { operation: 'set', path: ['g', 3], value: { id: 4 } },
            { operation: 'set', path: ['g', 4], value: { id: 5 } }
        ]);
    });

    it('should track pushing a found proxy object', () => {
        const objectProxyWithId4 = objectProxy.proxy.g.find((item: any) => item.id === 4);
        const originalObjectWithId4 = objectProxy['initialObject'].g.find((item: any) => item.id === 4);
        const proxyTarget = objectProxyWithId4.__target;
        expect(proxyTarget).toBe(originalObjectWithId4);

        objectProxy.proxy.g.push(objectProxyWithId4);
        expect(operations).toEqual([
            { operation: 'insert', path: ['g'], position: 5, items: [{ id: 4 }] }
        ]);
        expect((operations[0] as any).items[0]).not.toBe(objectProxyWithId4);
        expect((operations[0] as any).items[0]).not.toBe(originalObjectWithId4);
    });

    it('should track array map operations', () => {
        const mapped = objectProxy.proxy.d.map((v: number) => v * 2);
        expect(mapped).toEqual([6, 8]);
        expect(operations).toEqual([]);
    });

    it('should track array filter operations', () => {
        const filtered = objectProxy.proxy.d.filter((v: number) => v > 3);
        expect(filtered).toEqual([4]);
        expect(operations).toEqual([]);
    });

    it('should track array fill operations', () => {
        objectProxy.proxy.d.fill(0);
        expect(operations).toEqual([
            { operation: 'set', path: ['d', 0], value: 0 },
            { operation: 'set', path: ['d', 1], value: 0 }
        ]);
    });

    it('should not track array findIndex operations', () => {
        const index = objectProxy.proxy.d.findIndex((v: number) => v === 3);
        expect(index).toBe(0);
        expect(operations).toEqual([]);
    });

    it('should not track array indexOf operations', () => {
        const obj = objectProxy.proxy.g[2];
        const index = objectProxy.proxy.g.indexOf(obj);
        expect(index).toBe(2);
        expect(operations).toEqual([]);
    });

    it('should not track array includes operations', () => {
        const includes = objectProxy.proxy.d.includes(4);
        expect(includes).toBe(true);
        expect(operations).toEqual([]);
    });

    it('should get array length property', () => {
        const length = objectProxy.proxy.d.length;
        expect(length).toBe(2);
        expect(operations).toEqual([]);
    });

    it('should track setting property on array element', () => {
        objectProxy.proxy.d[0] = 10;
        expect(operations).toEqual([{ operation: 'set', path: ['d', 0], value: 10 }]);
    });

    it('should track setting property via bracket notation', () => {
        const propName = 'a';
        objectProxy.proxy[propName] = 50;
        expect(operations).toEqual([{ operation: 'set', path: ['a'], value: 50 }]);
    });

    it('should create a proxy for newly assigned object property', () => {
        objectProxy.proxy.newObj = { x: 1 };
        operations = [];
        objectProxy.proxy.newObj.x = 2;
        expect(operations).toEqual([{ operation: 'set', path: ['newObj', 'x'], value: 2 }]);
    });

    it('should create a proxy for newly assigned array property', () => {
        objectProxy.proxy.newArr = [1, 2, 3];
        operations = [];
        objectProxy.proxy.newArr.push(4);
        expect(operations).toEqual([{ operation: 'insert', path: ['newArr'], position: 3, items: [4] }]);
    });

    it('should track multiple operations', () => {
        objectProxy.proxy.a = 10;
        objectProxy.proxy.b.c = 20;
        objectProxy.proxy.d.push(5);
        expect(operations).toEqual([
            { operation: 'set', path: ['a'], value: 10 },
            { operation: 'set', path: ['b', 'c'], value: 20 },
            { operation: 'insert', path: ['d'], position: 2, items: [5] }
        ]);
    });

    it('should track assigning a new array to an existing array property', () => {
        objectProxy.proxy.d = [10, 20, 30];
        expect(operations).toEqual([{ operation: 'set', path: ['d'], value: [10, 20, 30] }]);
    });

    it('should track assigning a new object to an existing object property', () => {
        objectProxy.proxy.b = { x: 1 };
        expect(operations).toEqual([{ operation: 'set', path: ['b'], value: { x: 1 } }]);
    });

    it('should track Object.assign operations', () => {
        Object.assign(objectProxy.proxy, { a: 100, g: 200 });
        expect(operations).toEqual([
            { operation: 'set', path: ['a'], value: 100 },
            { operation: 'set', path: ['g'], value: 200 }
        ]);
    });

    it('should track setting property on object found via find', () => {
        const found = objectProxy.proxy.e.find((item: any) => item.f === 5);
        found.f = 15;
        expect(operations).toEqual([{ operation: 'set', path: ['e', 0, 'f'], value: 15 }]);
    });

    it('should throw an error when deleting a property', () => {
        expect(() => {
            delete objectProxy.proxy.a;
        }).toThrowError('Not implemented');
    });

    it('should track find and set operations on nested objects', () => {
        const obj = { items: [{ id: 1, name: 'first' }, { id: 2, name: 'second' }] };
        const proxy = new OperationsRecorderProxy(obj);
        const operations: Operation[] = [];
        proxy.operations.subscribe(op => operations.push(op));
        const value = proxy.proxy.items.find((v) => v.id === 2)!;
        expect((value as any).__isProxy).toBe(true);
        value.name = 'third';
        expect(operations).toEqual([{ operation: 'set', path: ['items', 1, 'name'], value: 'third' }]);
    });
});
