import { OperationsApplierYjs, Operation } from '..';
import * as Y from 'yjs';

describe('OperationsApplierYjs', () => {
    let applier: OperationsApplierYjs;
    let doc: Y.Doc;
    let map: Y.Map<any>;

    beforeEach(() => {
        applier = new OperationsApplierYjs();
        doc = new Y.Doc();
        map = new Y.Map();
        doc.getMap('root').set('myMap', map);
    });

    describe('applyOperations', () => {
        it('deve aplicar uma única operação de set em um mapa', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['a'],
                    value: 42,
                },
            ];

            applier.applyOperations(map, operations);

            expect(map.get('a')).toBe(42);
        });

        it('deve aplicar múltiplas operações de set em um mapa', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['a'],
                    value: 1,
                },
                {
                    operation: 'set',
                    path: ['b'],
                    value: 'hello',
                },
                {
                    operation: 'set',
                    path: ['c'],
                    value: true,
                },
            ];

            applier.applyOperations(map, operations);

            expect(map.get('a')).toBe(1);
            expect(map.get('b')).toBe('hello');
            expect(map.get('c')).toBe(true);
        });

        it('deve aplicar operação de set em um mapa aninhado', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['nested', 'inner', 'value'],
                    value: 'deep',
                },
            ];

            applier.applyOperations(map, operations);

            const nested = map.get('nested') as Y.Map<any>;
            const inner = nested.get('inner') as Y.Map<any>;
            expect(inner.get('value')).toBe('deep');
        });

        it('deve aplicar operação de set em um array', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['myArray', 0],
                    value: 'first',
                },
            ];

            applier.applyOperations(map, operations);

            const myArray = map.get('myArray') as Y.Array<any>;
            expect(myArray.get(0)).toBe('first');
        });

        it('deve aplicar operação de splice em um array', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['myArray'],
                    value: [],
                },
                {
                    operation: 'delete',
                    path: ['myArray'],
                    position: 0,
                    count: 0,
                },
                {
                    operation: 'insert',
                    path: ['myArray'],
                    position: 0,
                    items: ['a', 'b', 'c'],
                },
            ];

            applier.applyOperations(map, operations);

            const myArray = map.get('myArray') as Y.Array<any>;
            expect(myArray.toArray()).toEqual(['a', 'b', 'c']);
        });

        it('deve aplicar múltiplas operações incluindo set e splice', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['myArray'],
                    value: ['x'],
                },
                {
                    operation: 'insert',
                    path: ['myArray'],
                    position: 1,
                    items: ['y', 'z'],
                },
                {
                    operation: 'set',
                    path: ['nested', 'count'],
                    value: 10,
                },
            ];

            applier.applyOperations(map, operations);

            const myArray = map.get('myArray') as Y.Array<any>;
            expect(myArray.toArray()).toEqual(['x', 'y', 'z']);

            const nested = map.get('nested') as Y.Map<any>;
            expect(nested.get('count')).toBe(10);
        });

        it('deve lidar com objetos complexos e arrays', () => {
            const complexValue = {
                number: 123,
                string: 'test',
                boolean: true,
                array: [1, 2, 3],
                object: { a: 'b' },
            };

            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['complex'],
                    value: complexValue,
                },
            ];

            applier.applyOperations(map, operations);

            const complex = map.get('complex') as Y.Map<any>;
            expect(complex.get('number')).toBe(123);
            expect(complex.get('string')).toBe('test');
            expect(complex.get('boolean')).toBe(true);

            const array = complex.get('array') as Y.Array<any>;
            expect(array.toArray()).toEqual([1, 2, 3]);

            const object = complex.get('object') as Y.Map<any>;
            expect(object.get('a')).toBe('b');
        });

        it('deve lançar erro ao definir tipos de valor inválidos', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['func'],
                    value: () => {},
                },
            ];

            expect(() => applier.applyOperations(map, operations)).toThrow(
                'Não é possível converter funções ou símbolos para Y.Doc'
            );
        });

        it('deve lançar erro quando o caminho é inválido', () => {
            const operations: Operation[] = [
                {
                    operation: 'delete',
                    path: ['a'],
                    position: 0,
                    count: 0,
                },
                {
                    operation: 'insert',
                    path: ['a'],
                    position: 0,
                    items: ['item'],
                },
                {
                    operation: 'set',
                    path: ['a', 'b', 'c'],
                    value: 'invalid',
                },
            ];

            expect(() => applier.applyOperations(map, operations)).toThrow(
                'Tipo de chave inválido no caminho na chave b'
            );
        });

        it('deve lançar erro ao fazer splice em tipo não-array', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['notAnArray'],
                    value: {},
                },
                {
                    operation: 'insert',
                    path: ['notAnArray'],
                    position: 0,
                    items: ['item'],
                },
            ];

            expect(() => applier.applyOperations(map, operations)).toThrow(
                'O alvo não é um Y.Array'
            );
        });

        it('deve lidar com estruturas profundamente aninhadas', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['level1', 'level2', 'level3', 'value'],
                    value: 'deepValue',
                },
            ];

            applier.applyOperations(map, operations);

            const level1 = map.get('level1') as Y.Map<any>;
            const level2 = level1.get('level2') as Y.Map<any>;
            const level3 = level2.get('level3') as Y.Map<any>;
            expect(level3.get('value')).toBe('deepValue');
        });

        it('deve lidar com índices de array fora do intervalo', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['myArray'],
                    value: [],
                },
                {
                    operation: 'set',
                    path: ['myArray', 5, 'hello'],
                    value: 'value',
                },
            ];

            expect(() => applier.applyOperations(map, operations)).toThrow(
                'array key is out of range, path: myArray'
            );
        });

        it('deve sobrescrever valores existentes em arrays', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['myArray'],
                    value: ['oldValue'],
                },
                {
                    operation: 'set',
                    path: ['myArray', 0],
                    value: 'newValue',
                },
            ];

            applier.applyOperations(map, operations);

            const myArray = map.get('myArray') as Y.Array<any>;
            expect(myArray.get(0)).toBe('newValue');
        });

        it('deve lidar com múltiplos splices no mesmo array', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['numbers'],
                    value: [1, 2, 3, 4, 5],
                },
                {
                    operation: 'delete',
                    path: ['numbers'],
                    position: 1,
                    count: 2,
                },
                {
                    operation: 'insert',
                    path: ['numbers'],
                    position: 2,
                    items: [6, 7],
                },
            ];

            applier.applyOperations(map, operations);

            const numbers = map.get('numbers') as Y.Array<any>;
            expect(numbers.toArray()).toEqual([1, 4, 6, 7, 5]);
        });

        it('deve ignorar valores undefined em objetos', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['data'],
                    value: {
                        a: 1,
                        b: undefined,
                        c: 3,
                    },
                },
            ];

            applier.applyOperations(map, operations);

            const data = map.get('data') as Y.Map<any>;
            expect(data.get('a')).toBe(1);
            expect(data.get('b')).toBeUndefined();
            expect(data.get('c')).toBe(3);
            expect(Array.from(data.keys())).toEqual(['a', 'c']);
        });

        it('deve lidar com definição de valores em arrays aninhados', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['arrays'],
                    value: [[]],
                },
                {
                    operation: 'set',
                    path: ['arrays', 0, 0],
                    value: 'nestedValue',
                },
            ];

            applier.applyOperations(map, operations);

            const arrays = map.get('arrays') as Y.Array<any>;
            const innerArray = arrays.get(0) as Y.Array<any>;
            expect(innerArray.get(0)).toBe('nestedValue');
        });

        it('deve lidar com operações aninhadas complexas', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['root', 'childArray'],
                    value: [],
                },
                {
                    operation: 'insert',
                    path: ['root', 'childArray'],
                    position: 0,
                    items: [{ id: 1 }, { id: 2 }],
                },
                {
                    operation: 'set',
                    path: ['root', 'childArray', 1, 'name'],
                    value: 'Item 2',
                },
            ];

            applier.applyOperations(map, operations);

            const root = map.get('root') as Y.Map<any>;
            const childArray = root.get('childArray') as Y.Array<any>;
            const item = childArray.get(1) as Y.Map<any>;
            expect(item.get('id')).toBe(2);
            expect(item.get('name')).toBe('Item 2');
        });

        it('deve lidar com array de operações vazio', () => {
            const operations: Operation[] = [];

            applier.applyOperations(map, operations);

            expect(map.size).toBe(0);
        });

        it('deve lidar com operações com chaves numéricas em formato de string', () => {
            const operations: Operation[] = [
                {
                    operation: 'set',
                    path: ['123'],
                    value: 'numericKey',
                },
            ];

            applier.applyOperations(map, operations);

            expect(map.get('123')).toBe('numericKey');
        });

        it('deve lançar erro para tipo de operação inválido', () => {
            const operations = [
                {
                    operation: 'invalid',
                    path: ['a'],
                    value: 1,
                } as any,
            ];

            expect(() => applier.applyOperations(map, operations)).toThrow();
        });
    });
});
