import { OperationsApplierJson, OperationsCompressor, Operation } from '..';


describe('OperationsCompressor class tests', () => {
    it('Simple set operation', () => {
        const initialObject = { a: 1, b: { c: 2 } };
        const operations: Operation[] = [
            { operation: 'set', path: ['b', 'c'], value: 3 },
        ];

        // Apply operations directly
        const result = { a: 1, b: { c: 3 } };

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        const originalResult = applier.applyOperations(initialObject, operations);

        expect(classResult).toEqual(result);
        expect(originalResult).toEqual(result);
    });

    it('Simple splice operation', () => {
        const initialObject = { a: [1, 2, 3, 4, 5] };
        const operations: Operation[] = [
            { operation: 'delete', path: ['a'], position: 1, count: 2 },
            { operation: 'insert', path: ['a'], position: 1, items: [6, 7] },
        ];

        // Apply operations directly
        const result = { a: [1, 6, 7, 4, 5] };

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        const originalResult = applier.applyOperations(initialObject, operations);

        expect(classResult).toEqual(result);
        expect(originalResult).toEqual(result);
    });

    it('Combination of set and splice operations', () => {
        const initialObject = { a: [1, 2, 3, 4, 5], b: { c: 2 } };
        const operations: Operation[] = [
            { operation: 'delete', path: ['a'], position: 1, count: 2 },
            { operation: 'insert', path: ['a'], position: 1, items: [6, 7] },
            { operation: 'set', path: ['b', 'c'], value: 3 },
            { operation: 'set', path: ['a', 3], value: 8 },
        ];

        // Apply operations directly
        let result = { a: [1, 6, 7, 8, 5], b: { c: 3 } };

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        const originalResult = applier.applyOperations(initialObject, operations);

        expect(classResult).toEqual(result);
        expect(originalResult).toEqual(result);
    });

    it('Edge case - set on non-object', () => {
        const initialObject = { a: 1 };
        const operations: Operation[] = [
            { operation: 'set', path: ['a', 'b'], value: 2 },
        ];

        // Expect error when using Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }
        expect(() => {
            let classResult = initialObject;
            classResult = applier.applyOperations(classResult, ops.spliceOperations);
            classResult = applier.applyOperations(classResult, ops.setOperations);
        }).toThrow('Cannot set property b on non-object');
    });

    it('Edge case - splice on non-array', () => {
        const initialObject = { a: { b: 1 } };
        const operations: Operation[] = [
            { operation: 'delete', path: ['a'], position: 0, count: 1 },
        ];

        // Expect error when using Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }
        expect(() => {
            let classResult = initialObject;
            classResult = applier.applyOperations(classResult, ops.spliceOperations);
            classResult = applier.applyOperations(classResult, ops.setOperations);
        }).toThrow('Target is not an array at path a');

        expect(() => {
            let classResult = initialObject;
            classResult = applier.applyOperations(classResult, operations);
        }).toThrow('Target is not an array at path a');
    });

    it('Splice that affects indices of set operations', () => {
        const initialObject = { a: [0, 1, 2, 3, 4, 5] };
        const operations: Operation[] = [
            { operation: 'set', path: ['a', 4], value: 50 },
            { operation: 'delete', path: ['a'], position: 2, count: 2 },
        ];

        // Apply operations directly
        let result = { a: [0, 1, 50, 5] };

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        const originalResult = applier.applyOperations(initialObject, operations);

        expect(classResult).toEqual(result);
        expect(originalResult).toEqual(result);
    });

    it('Edge case - empty path', () => {
        const operations: Operation[] = [
            { operation: 'set', path: [], value: { b: 2 } },
        ];

        expect(() => {
            const ops = new OperationsCompressor();
            for (const op of operations) {
                ops.addOperation(op);
            }
        }).toThrow('Path cannot be empty');
    });

    it('Complex nested operations', () => {
        const initialObject = { a: [{ b: { c: [1, 2, 3] } }, { b: { c: [4, 5, 6] } }] };
        const operations: Operation[] = [
            { operation: 'set', path: ['a', 0, 'b', 'c', 1], value: 20 },
            { operation: 'delete', path: ['a', 1, 'b', 'c'], position: 0, count: 2 },
            { operation: 'insert', path: ['a', 1, 'b', 'c'], position: 0, items: [7, 8] },
        ];

        // Apply operations directly
        const result = { a: [{ b: { c: [1, 20, 3] } }, { b: { c: [7, 8, 6] } }] };

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        const originalResult = applier.applyOperations(initialObject, operations);

        expect(classResult).toEqual(result);
        expect(originalResult).toEqual(result);
    });

    it('Multiple set operations to the same path', () => {
        const initialObject = { a: 1 };
        const operations: Operation[] = [
            { operation: 'set', path: ['a'], value: 2 },
            { operation: 'set', path: ['a'], value: 3 },
        ];

        // Apply operations directly
        const result = { a: 3 };

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        const originalResult = applier.applyOperations(initialObject, operations);

        expect(classResult).toEqual(result);
        expect(originalResult).toEqual(result);
    });

    it('Set operations overlapping with splice operations', () => {
        const initialObject = { a: [10, 20, 30, 40, 50] };
        const operations: Operation[] = [
            { operation: 'set', path: ['a', 3], value: 35 },
            { operation: 'delete', path: ['a'], position: 2, count: 2 },
            { operation: 'insert', path: ['a'], position: 2, items: [60, 70] },
            { operation: 'set', path: ['a', 4], value: 80 },
        ];

        // Apply operations directly
        const result = { a: [10, 20, 60, 70, 80] };

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        const originalResult = applier.applyOperations(initialObject, operations);

        expect(classResult).toEqual(result);
        expect(originalResult).toEqual(result);
    });
    it('Large list of mixed operations', () => {
        const initialObject = {
            array: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            nested: { a: { b: { c: 10 } } },
            value: 20,
        };

        const operations: Operation[] = [
            { operation: 'set', path: ['value'], value: 30 },
            { operation: 'delete', path: ['array'], position: 2, count: 3 },
            { operation: 'insert', path: ['array'], position: 2, items: [100, 101] },
            { operation: 'set', path: ['array', 5], value: 200 },
            { operation: 'set', path: ['nested', 'a', 'b', 'c'], value: 50 },
            { operation: 'delete', path: ['array'], position: 0, count: 2 },
            { operation: 'set', path: ['array', 0], value: 300 },
            { operation: 'insert', path: ['array'], position: 3, items: [400] },
            { operation: 'set', path: ['array', 4], value: 500 },
            { operation: 'set', path: ['nested', 'a', 'b', 'd'], value: 60 },
            { operation: 'delete', path: ['array'], position: 5, count: 1 },
            // Adicione mais operações conforme necessário para aumentar o tamanho
        ];

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    });

    it('Another large list with overlapping operations', () => {
        const initialObject = {
            list: ['a', 'b', 'c', 'd', 'e', 'f'],
            obj: { x: 1, y: 2 },
        };

        const operations: Operation[] = [
            { operation: 'set', path: ['obj', 'x'], value: 10 },
            { operation: 'set', path: ['list', 2], value: 'z' },
            { operation: 'delete', path: ['list'], position: 1, count: 2 },
            { operation: 'insert', path: ['list'], position: 1, items: ['m', 'n'] },
            { operation: 'set', path: ['list', 3], value: 'o' },
            { operation: 'set', path: ['obj', 'z'], value: 20 },
            { operation: 'delete', path: ['list'], position: 0, count: 1 },
            { operation: 'insert', path: ['list'], position: 0, items: ['p'] },
            { operation: 'set', path: ['list', 0], value: 'q' },
            { operation: 'insert', path: ['list'], position: 4, items: ['r', 's'] },
            { operation: 'set', path: ['list', 5], value: 't' },
            { operation: 'set', path: ['obj', 'y'], value: 30 },
            // Mais operações podem ser adicionadas aqui
        ];

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    });

    it('Randomly generated operations with numbers', () => {
        const initialObject = { numbers: [2], data: {} };
        const operations: Operation[] = [];

        // Generate random numbers array
        initialObject.numbers = Array.from({ length: 20 }, (_, i) => i);

        // Generate random operations
        const nums = initialObject.numbers.slice();
        for (let i = 0; i < 20; i++) {
            if (Math.random() < 0.333) {
                // Generate set operation
                const index = Math.floor(Math.random() * nums.length);
                const value = Math.floor(Math.random() * 1000);
                operations.push({
                    operation: 'set',
                    path: ['numbers', index],
                    value,
                });
                nums[index] = value;
            } else if (Math.random() < 0.5) {
                // Generate splice operation
                const start = Math.floor(Math.random() * nums.length);
                const deleteCount = Math.min(Math.floor(Math.random() * 5), nums.length - start);
                const itemsToAdd = Array.from(
                    { length: Math.floor(Math.random() * 4) },
                    () => Math.floor(Math.random() * 1000)
                );
                nums.splice(start, deleteCount, ...itemsToAdd);
                if (deleteCount > 0) {
                    operations.push({ operation: 'delete', path: ['numbers'], position: start, count: deleteCount });
                }
                if (itemsToAdd.length > 0) {
                    operations.push({ operation: 'insert', path: ['numbers'], position: start, items: itemsToAdd });
                }
            } else {
                const key = `key${i}`;
                const value = Math.floor(Math.random() * 1000);
                operations.push({
                    operation: 'set',
                    path: ['data', key],
                    value,
                });
            }
        }

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
        expect(classResult.numbers).toEqual(nums);
    });

    it('Complex interaction between isnert and delete operations with cancelation 1', () => {
        const initialObject = { numbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]}

        const operations: Operation[] = [
            {
              operation: 'insert',
              path: [ 'numbers' ],
              position: 2,
              items: [ 208, 210, 400 ]
            },
            { operation: 'delete', path: [ 'numbers' ], position: 3, count: 2 },
            {
              operation: 'insert',
              path: [ 'numbers' ],
              position: 14,
              items: [ 867, 0, 474 ]
            },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
            {
              operation: 'insert',
              path: [ 'numbers' ],
              position: 10,
              items: [ 149, 913, 187 ]
            },
            
            
            { operation: 'delete', path: [ 'numbers' ], position: 7, count: 1 },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
           
          ];

          // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        ops.addOperation(operations[0]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208, 210, 400 ] }
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 210, 400, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[1]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[2]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[3]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 6, 7, 8, 12, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[4]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
            { operation: 'insert', path: [ 'numbers' ], position: 10, items: [ 149, 913, 187 ] },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 6, 7, 8, 149, 913, 187, 12, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[5]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
            { operation: 'insert', path: [ 'numbers' ], position: 10, items: [ 149, 913, 187 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 7, count: 1 },
        ]);
        // { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 7, 8, 149, 913, 187, 12, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[6]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
            { operation: 'insert', path: [ 'numbers' ], position: 10, items: [ 149 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 7, count: 1 },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 1 },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 7, 8, 149, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    })
    it('Complex interaction between isnert and delete operations with cancelation 1', () => {
        const initialObject = { numbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]}

        const operations: Operation[] = [
            {
              operation: 'insert',
              path: [ 'numbers' ],
              position: 2,
              items: [ 208, 210, 400 ]
            },
            { operation: 'delete', path: [ 'numbers' ], position: 3, count: 2 },
            {
              operation: 'insert',
              path: [ 'numbers' ],
              position: 14,
              items: [ 867, 0, 474 ]
            },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
            {
              operation: 'insert',
              path: [ 'numbers' ],
              position: 10,
              items: [ 149, 913, 187 ]
            },
            
            
            { operation: 'delete', path: [ 'numbers' ], position: 7, count: 1 },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
           
          ];

          // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        ops.addOperation(operations[0]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208, 210, 400 ] }
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 210, 400, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[1]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[2]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[3]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 6, 7, 8, 12, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[4]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
            { operation: 'insert', path: [ 'numbers' ], position: 10, items: [ 149, 913, 187 ] },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 6, 7, 8, 149, 913, 187, 12, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[5]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
            { operation: 'insert', path: [ 'numbers' ], position: 10, items: [ 149, 913, 187 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 7, count: 1 },
        ]);
        // { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 7, 8, 149, 913, 187, 12, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });
        ops.addOperation(operations[6]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: [ 'numbers' ], position: 2, items: [ 208 ] },
            { operation: 'insert', path: [ 'numbers' ], position: 14, items: [ 867, 0, 474 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 3 },
            { operation: 'insert', path: [ 'numbers' ], position: 10, items: [ 149 ] },
            { operation: 'delete', path: [ 'numbers' ], position: 7, count: 1 },
            { operation: 'delete', path: [ 'numbers' ], position: 10, count: 1 },
        ]);
        expect(applier.applyOperations(initialObject, ops.spliceOperations)).toEqual({ numbers: [0, 1, 208, 2, 3, 4, 5, 7, 8, 149, 867, 0, 474, 13, 14, 15, 16, 17, 18, 19] });

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    })
    it('Complex interaction between isnert and delete operations with cancelation 2', () => {
        const initialObject = { numbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]}

        const operations: Operation[] = [
            { operation: 'delete', path: ['numbers'], position: 0, count: 2 }, // ok
            { operation: 'insert', path: ['numbers'], position: 0, items: [620] }, // ok
            { operation: 'delete', path: ['numbers'], position: 9, count: 2 }, // ok
            { operation: 'delete', path: ['numbers'], position: 4, count: 3 }, // ok
            { operation: 'insert', path: ['numbers'], position: 4, items: [562] }, // ok
            { operation: 'delete', path: ['numbers'], position: 8, count: 1 }, // ok
            { operation: 'insert', path: ['numbers'], position: 8, items: [513] }, // ok
            { operation: 'delete', path: ['numbers'], position: 11, count: 2 }, // ok
            { operation: 'insert', path: ['numbers'], position: 11, items: [455, 950] }, // ok
            { operation: 'insert', path: ['numbers'], position: 1, items: [146, 497, 59] }, // ok
            { operation: 'delete', path: ['numbers'], position: 14, count: 3 }, // ok
            { operation: 'insert', path: ['numbers'], position: 14, items: [86] }, // ok
            { operation: 'delete', path: ['numbers'], position: 5, count: 3 }, // ok
            { operation: 'insert', path: ['numbers'], position: 5, items: [450, 840, 49] }, // ok
            { operation: 'delete', path: ['numbers'], position: 13, count: 3 }, // ok
            { operation: 'insert', path: ['numbers'], position: 13, items: [661, 830] },
            { operation: 'delete', path: ['numbers'], position: 13, count: 2 },
            { operation: 'insert', path: ['numbers'], position: 13, items: [138, 387] }, // here
            { operation: 'delete', path: ['numbers'], position: 5, count: 4 },
            { operation: 'insert', path: ['numbers'], position: 5, items: [313, 64] },
            { operation: 'insert', path: ['numbers'], position: 12, items: [225] }, // here
            { operation: 'delete', path: ['numbers'], position: 13, count: 1 },
            { operation: 'insert', path: ['numbers'], position: 13, items: [52, 742, 212] },
            { operation: 'delete', path: ['numbers'], position: 15, count: 1 },
            { operation: 'delete', path: ['numbers'], position: 6, count: 1 },
            { operation: 'insert', path: ['numbers'], position: 9, items: [613, 899] },
            { operation: 'delete', path: ['numbers'], position: 14, count: 2 },
            { operation: 'insert', path: ['numbers'], position: 14, items: [528, 369] },
            { operation: 'delete', path: ['numbers'], position: 7, count: 3 },
            { operation: 'insert', path: ['numbers'], position: 7, items: [194] },
            { operation: 'delete', path: ['numbers'], position: 7, count: 2 },
            { operation: 'insert', path: ['numbers'], position: 7, items: [783, 965, 659] },
            { operation: 'delete', path: ['numbers'], position: 7, count: 2 },
            { operation: 'insert', path: ['numbers'], position: 7, items: [297] }
        ];

          // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (let i = 0; i < 21; i++) {
            const op = operations[i];
            ops.addOperation(op);
            let classResult = initialObject;
            classResult = applier.applyOperations(classResult, ops.spliceOperations);
            const originalResult = applier.applyOperations(initialObject, operations.slice(0, i + 1));
            expect(classResult).toEqual(originalResult);
        }

        ops.addOperation(operations[21]);

        // { operation: 'delete', path: ['numbers'], position: 13, count: 1 },
        const op2 = [
            { operation: 'delete', path: ['numbers'], position: 0, count: 2 },
            { operation: 'insert', path: ['numbers'], position: 0, items: [620] },
            { operation: 'delete', path: ['numbers'], position: 9, count: 2 },
            { operation: 'delete', path: ['numbers'], position: 4, count: 3 },
            { operation: 'delete', path: ['numbers'], position: 7, count: 1 },
            { operation: 'insert', path: ['numbers'], position: 7, items: [513] },
            { operation: 'delete', path: ['numbers'], position: 10, count: 2 },
            { operation: 'insert', path: ['numbers'], position: 1, items: [146, 497, 59] },
            { operation: 'delete', path: ['numbers'], position: 13, count: 1 },
            { operation: 'delete', path: ['numbers'], position: 5, count: 2 },
            { operation: 'delete', path: ['numbers'], position: 10, count: 2 },
            { operation: 'insert', path: ['numbers'], position: 10, items: [138] },
            { operation: 'delete', path: ['numbers'], position: 5, count: 1 },
            { operation: 'insert', path: ['numbers'], position: 5, items: [313, 64] },
            { operation: 'insert', path: ['numbers'], position: 12, items: [225] },
          ];

          expect(ops.spliceOperations).toEqual(op2);

        for (let i = 22; i < operations.length; i++) {
            const op = operations[i];
            ops.addOperation(op);
            let classResult = initialObject;
            classResult = applier.applyOperations(classResult, ops.spliceOperations);
            const originalResult = applier.applyOperations(initialObject, operations.slice(0, i + 1));
            expect(classResult).toEqual(originalResult);
        }
    })

    it('Validate insertion and deletion operation sequencing with complex array manipulations', () => {
        const initialObject = { items: [{ id: 1, p: [0, 1] }, { id: 2, p: [0, 1] }, { id: 3, p: [0, 1] }, { id: 4, p: [0, 1] }] };

        const operations: Operation[] = [
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] },
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 5, p: [0, 1] }, { id: 6, p: [0, 1] }] },
            { operation: 'delete', path: ["items", 1, 'p'], position: 1, count: 1 },
            { operation: 'delete', path: ["items", 3, 'p'], position: 1, count: 1 },
            { operation: 'delete', path: ['items'], position: 1, count: 1 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();

        ops.addOperation(operations[0]);
        expect(ops.spliceOperations).toEqual([{ operation: 'insert', path: ["items"], position: 0, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] }]);
        ops.addOperation(operations[1]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] },
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 5, p: [0, 1] }, { id: 6, p: [0, 1] }] },
        ]);
        ops.addOperation(operations[2]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] },
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 5, p: [0, 1] }, { id: 6, p: [0, 1] }] },
            { operation: 'delete', path: ["items", 1, 'p'], position: 1, count: 1 },
        ]);
        ops.addOperation(operations[3]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] },
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 5, p: [0, 1] }, { id: 6, p: [0, 1] }] },
            { operation: 'delete', path: ["items", 1, 'p'], position: 1, count: 1 },
            { operation: 'delete', path: ["items", 3, 'p'], position: 1, count: 1 },
        ]);
        ops.addOperation(operations[4]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] },
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 5, p: [0, 1] }] },
            { operation: 'delete', path: ["items", 2, 'p'], position: 1, count: 1 },
        ]);

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    });

    it('Test overlapping insertions and nested deletion handling', () => {
        const initialObject = { items: [{ id: 1, p: [0, 1] }, { id: 2, p: [0, 1] }, { id: 3, p: [0, 1] }, { id: 4, p: [0, 1] }] };

        const operations: Operation[] = [
            { operation: 'insert', path: ["items"], position: 2, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] },
            { operation: 'insert', path: ["items", 2, 'p'], position: 0, items: [-1, -2] },
            { operation: 'delete', path: ["items"], position: 0, count: 2 },
            { operation: 'delete', path: ["items", 0, 'p'], position: 1, count: 1 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();

        ops.addOperation(operations[0]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 2, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] }
        ]);
        ops.addOperation(operations[1]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 2, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] },
            { operation: 'insert', path: ["items", 2, 'p'], position: 0, items: [-1, -2] },
        ]);
        ops.addOperation(operations[2]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 2, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] },
            { operation: 'insert', path: ["items", 2, 'p'], position: 0, items: [-1, -2] },
            { operation: 'delete', path: ["items"], position: 0, count: 2 },
        ]);
        ops.addOperation(operations[3]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 2, items: [{ id: 7, p: [0, 1] }, { id: 8, p: [0, 1] }] },
            { operation: 'insert', path: ["items", 2, 'p'], position: 0, items: [-1] },
            { operation: 'delete', path: ["items"], position: 0, count: 2 },
        ]);

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    });

    it('Verify insertion followed by deletions with positional adjustments', () => {
        const initialObject = { items: [{ id: 1, p: [0, 1] }, { id: 2, p: [0, 1] }, { id: 3, p: [0, 1] }, { id: 4, p: [0, 1] }] };

        const operations: Operation[] = [
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 5, p: [0, 1] }, { id: 6, p: [0, 1] }] },
            { operation: 'delete', path: ["items", 2, 'p'], position: 1, count: 1 },
            { operation: 'delete', path: ['items'], position: 1, count: 1 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        ops.addOperation(operations[0]);
        expect(ops.spliceOperations).toEqual([{ operation: 'insert', path: ["items"], position: 0, items: [{ id: 5, p: [0, 1] }, { id: 6, p: [0, 1] }] }]);
        ops.addOperation(operations[1]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 5, p: [0, 1] }, { id: 6, p: [0, 1] }] },
            { operation: 'delete', path: ["items", 2, 'p'], position: 1, count: 1 }
        ]);
        ops.addOperation(operations[2]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ["items"], position: 0, items: [{ id: 5, p: [0, 1] }] },
            { operation: 'delete', path: ["items", 1, 'p'], position: 1, count: 1 },
        ]);

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    })

    it('Evaluate mixed insertions and deletions with array re-indexing', () => {
        const initialObject = { numbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], data: {} };

        const operations: Operation[] = [
            {
                operation: 'insert',
                path: ['numbers'],
                position: 6,
                items: [383, 643, 484]
            },
            { operation: 'delete', path: ['numbers'], position: 11, count: 1 },


            { operation: 'delete', path: ['numbers'], position: 5, count: 3 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();

        ops.addOperation(operations[0]);
        expect(ops.spliceOperations).toEqual([{ operation: 'insert', path: ['numbers'], position: 6, items: [383, 643, 484] }]);
        ops.addOperation(operations[1]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ['numbers'], position: 6, items: [383, 643, 484] },
            { operation: 'delete', path: ['numbers'], position: 11, count: 1 }
        ]);
        ops.addOperation(operations[2]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'insert', path: ['numbers'], position: 6, items: [484] },
            { operation: 'delete', path: ['numbers'], position: 9, count: 1 },
            { operation: 'delete', path: ['numbers'], position: 5, count: 1 }
        ]);

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    })

    it('Check sequential insertion and multi-step deletions', () => {
        const initialObject = { numbers: [0, 1, 2, 3, 4, 5], data: {} };

        const operations: Operation[] = [
            {
                operation: 'insert',
                path: ['numbers'],
                position: 1,
                items: [538, 79]
            },
            { operation: 'delete', path: ['numbers'], position: 4, count: 2 },

            { operation: 'delete', path: ['numbers'], position: 0, count: 3 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    });

    it('Handle simple insertions and deletions in predefined array structures', () => {
        const initialObject = { numbers: [0, 1, 2, 3, 4, 5], data: {} };

        // Generate random numbers array
        // initialObject.numbers = Array.from({ length: 20 }, (_, i) => i);

        const operations: Operation[] = [
            {
                operation: 'insert',
                path: ['numbers'],
                position: 4,
                items: [342]
            },
            { operation: 'delete', path: ['numbers'], position: 0, count: 2 },
            { operation: 'delete', path: ['numbers'], position: 2, count: 2 },

        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
        expect(originalResult.numbers).toEqual([2, 3, 5]);
    });

    it('Compact multiple insertions and deletions into minimal operation set', () => {
        const operations: Operation[] = [
            { operation: 'insert', path: ['numbers'], position: 1, items: [-1] },
            { operation: 'delete', path: ['numbers'], position: 0, count: 2 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        expect(ops.spliceOperations).toEqual([
            { operation: 'delete', path: ['numbers'], position: 0, count: 1 }
        ]);
    });

    it('Verify compression with sequential deletions and re-positioning', () => {
        const initialObject = { numbers: [2], data: {} };
        initialObject.numbers = Array.from({ length: 10 }, (_, i) => i);

        const operations: Operation[] = [
            { operation: 'insert', path: ['numbers'], position: 6, items: [75] },
            { operation: 'delete', path: ['numbers'], position: 5, count: 3 },
            { operation: 'delete', path: ['numbers'], position: 3, count: 1 },
        ]

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        ops.addOperation(operations[0]);
        expect(ops.spliceOperations).toEqual([{ operation: 'insert', path: ['numbers'], position: 6, items: [75] }]);

        ops.addOperation(operations[1]);
        expect(ops.spliceOperations).toEqual([{ operation: 'delete', path: ['numbers'], position: 5, count: 2 }]);

        ops.addOperation(operations[2]);
        expect(ops.spliceOperations).toEqual([
            { operation: 'delete', path: ['numbers'], position: 5, count: 2 },
            { operation: 'delete', path: ['numbers'], position: 3, count: 1 }
        ]);

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    })

    it('Splice on parent should not remove previous splice if start index is greater', () => {
        const initialObject = { items: [{ p: [0, 1] }, { p: [0, 1] }] };

        const operations: Operation[] = [
            { operation: 'delete', path: ["items", 0, "p"], position: 0, count: 2 },
            { operation: 'delete', path: ['items'], position: 1, count: 1 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(originalResult).toEqual({ items: [{ p: [] }] });
        expect(classResult).toEqual(originalResult);
    })
    it('Splice on parent should remove previous splice if start index is zero', () => {
        const initialObject = { items: [{ p: [0, 1] }, { p: [0, 1] }] };

        const operations: Operation[] = [
            { operation: "delete", path: ["items", 0, "p"], position: 0, count: 2 },
            { operation: "delete", path: ["items"], position: 0, count: 1 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(originalResult).toEqual({ items: [{ p: [0, 1] }] });
        expect(classResult).toEqual(originalResult);
        expect(ops.spliceOperations).toEqual([{ operation: "delete", path: ["items"], position: 0, count: 1 }]);
    });

    it('Splice on parent should not remove previous splice', () => {
        const initialObject = { items: [{ p: [0, 1] }, { p: [0, 1] }] };

        const operations: Operation[] = [
            { operation: "delete", path: ["items", 1, "p"], position: 0, count: 2 },
            { operation: "delete", path: ["items"], position: 0, count: 1 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(originalResult).toEqual({ items: [{ p: [] }] });
        expect(classResult).toEqual(originalResult);
        expect(ops.spliceOperations).toEqual([
            { operation: "delete", path: ["items", 1, "p"], position: 0, count: 2 },
            { operation: "delete", path: ["items"], position: 0, count: 1 }
        ]);
    });

    it('Randomly generated operations with more complexity', () => {
        const initialObject: { paths: { id: number, name: string, points: number[] }[], data: any } = { paths: [], data: {} };
        const operations: Operation[] = [];

        // Generate random numbers array
        initialObject.paths = Array.from({ length: 20 }, (_, i) => ({ id: i, name: `${i}`, points: [1, 2, 3, 4, 5, 6] }));

        const clone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

        // Generate random operations
        const copy: { paths: { id: number, name: string, points: number[] }[], data: any } = clone(initialObject);
        for (let i = 0; i < 10; i++) {
            const random = Math.random();
            if (random < 0.2) {
                // Generate set operation
                if (copy.paths.length > 0) {
                    const index = Math.floor(Math.random() * copy.paths.length);
                    const value = Math.floor(Math.random() * 1000);
                    copy.paths[index].name = `${value}`;
                    operations.push({
                        operation: 'set',
                        path: ['paths', index, 'name'],
                        value: `${value}`
                    });
                } else {
                    const itemsToAdd = Array.from(
                        { length: Math.floor(Math.random() * 10) },
                        () => ({ id: Math.floor(Math.random() * 1000), name: `${Math.floor(Math.random() * 1000)}`, points: [1, 2, 3, 4, 5, 6] })
                    );
                    copy.paths.push(...clone(itemsToAdd));
                    if (itemsToAdd.length > 0) {
                        operations.push({
                            operation: 'insert',
                            path: ['paths'],
                            position: 0,
                            items: clone(itemsToAdd),
                        });
                    }
                }
            } else if (random < 0.4) {
                // Generate splice operation
                const start = Math.floor(Math.random() * copy.paths.length);
                const deleteCount = Math.min(Math.floor(Math.random() * 3), copy.paths.length - start);
                const itemsToAdd = Array.from(
                    { length: Math.floor(Math.random() * 10) },
                    () => ({ id: Math.floor(Math.random() * 1000), name: `${Math.floor(Math.random() * 1000)}`, points: [1, 2, 3, 4, 5, 6] })
                );
                copy.paths.splice(start, deleteCount, ...clone(itemsToAdd));
                if (deleteCount > 0) {
                    operations.push({
                        operation: 'delete',
                        path: ['paths'],
                        position: start,
                        count: deleteCount,
                    });
                }
                if (itemsToAdd.length > 0) {
                    operations.push({
                        operation: 'insert',
                        path: ['paths'],
                        position: start,
                        items: clone(itemsToAdd),
                    });
                }
            } else if (random < 0.6) {
                const key = `key${i}`;
                const value = Math.floor(Math.random() * 1000);
                copy.data[key] = value;
                operations.push({
                    operation: 'set',
                    path: ['data', key],
                    value
                });
            } else if (random < 0.8) {
                if (copy.paths.length > 0) {
                    const index = Math.floor(Math.random() * copy.paths.length);
                    const path = copy.paths[index];
                    if (path.points.length > 0) {
                        const pointIndex = Math.floor(Math.random() * path.points.length);
                        const value = Math.floor(Math.random() * 1000);
                        path.points[pointIndex] = value;
                        operations.push({
                            operation: 'set',
                            path: ['paths', index, 'points', pointIndex],
                            value
                        });
                    }
                }
            } else {
                // Generate set operation
                if (copy.paths.length === 0) {
                    const itemsToAdd = Array.from(
                        { length: Math.floor(Math.random() * 10) },
                        () => ({ id: Math.floor(Math.random() * 1000), name: `${Math.floor(Math.random() * 1000)}`, points: [1, 2, 3, 4, 5, 6] })
                    );
                    copy.paths.push(...clone(itemsToAdd));
                    if (itemsToAdd.length > 0) {
                        operations.push({
                            operation: 'insert',
                            path: ['paths'],
                            position: 0,
                            items: clone(itemsToAdd),
                        });
                    }
                } else {
                    const index = Math.floor(Math.random() * copy.paths.length);
                    const path = copy.paths[index];
                    const start = Math.floor(Math.random() * path.points.length);
                    const deleteCount = Math.min(Math.floor(Math.random() * 5), path.points.length - start);
                    const itemsToAdd = Array.from(
                        { length: Math.floor(Math.random() * 4) },
                        () => Math.floor(Math.random() * 1000)
                    );
                    path.points.splice(start, deleteCount, ...clone(itemsToAdd));
                    if (deleteCount > 0) {
                        operations.push({
                            operation: 'delete',
                            path: ['paths', index, 'points'],
                            position: start,
                            count: deleteCount,
                        });
                    }
                    if (itemsToAdd.length > 0) {
                        operations.push({
                            operation: 'insert',
                            path: ['paths', index, 'points'],
                            position: start,
                            items: clone(itemsToAdd),
                        });
                    }
                }
            }
        }

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
        expect(classResult).toEqual(copy);
    });

    it('Operations with overlapping set paths', () => {
        const initialObject = { a: { b: { c: 1, d: 2 }, e: 3 }, f: 4 };
        const operations: Operation[] = [
            { operation: 'set', path: ['a', 'b', 'c'], value: 10 },
            { operation: 'set', path: ['a', 'b'], value: { c: 20, d: 30 } },
            { operation: 'set', path: ['a'], value: { b: { c: 40, d: 50 }, e: 60 } },
            { operation: 'set', path: ['f'], value: 70 },
            { operation: 'set', path: ['a', 'b', 'd'], value: 80 },
        ];

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations); // No splices here
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    });

    it('Operations with splices affecting set indices', () => {
        const initialObject = { arr: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], val: 100 };
        const operations: Operation[] = [
            { operation: 'set', path: ['arr', 5], value: 55 },
            { operation: 'delete', path: ['arr'], position: 3, count: 2 },
            { operation: 'insert', path: ['arr'], position: 3, items: [33, 44] },
            { operation: 'set', path: ['arr', 7], value: 77 },
            { operation: 'delete', path: ['arr'], position: 6, count: 1 },
            { operation: 'set', path: ['arr', 4], value: 99 },
            { operation: 'delete', path: ['arr'], position: 0, count: 3 },
            { operation: 'set', path: ['arr', 2], value: 22 },
        ];

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
    });

    it('Move a point with mouse move events', () => {
        const initialObject = { x: 0, y: 0, points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] };
        const operations: Operation[] = [];

        // Generate random operations
        let copy = JSON.parse(JSON.stringify(initialObject));
        for (let i = 0; i < 1000; i++) {
            const pointIndex = Math.floor(Math.random() * copy.points.length);
            const point = copy.points[pointIndex];
            const dx = Math.floor(Math.random() * 10) - 5;
            const dy = Math.floor(Math.random() * 10) - 5;
            point.x += dx;
            point.y += dy;
            operations.push({
                operation: 'set',
                path: ['points', pointIndex, 'x'],
                value: point.x,
            });
            operations.push({
                operation: 'set',
                path: ['points', pointIndex, 'y'],
                value: point.y,
            });
        }
        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
        expect(classResult).toEqual(copy);

    });

    it('Move a item in a timeline with layers', () => {
        const initialObject = { layers: [{ items: [{ id: 'toMove', start: 400 }] }, { items: [{ id: 'keep', start: 700 }] }] };
        const operations: Operation[] = [];

        // Generate random operations
        let copy = JSON.parse(JSON.stringify(initialObject));
        let layerIndex = 0;
        let currentIndex = 0;
        for (let i = 0; i < 1000; i++) {
            const random = Math.random();
            if (random < 0.01) {
                // Move item to another layer
                const item = copy.layers[layerIndex].items.splice(currentIndex, 1)[0];
                const oldLayerIndex = layerIndex;
                const oldIndex = currentIndex;
                layerIndex = layerIndex === 0 ? 1 : 0;
                if (item.start < 700 || layerIndex === 0) {
                    currentIndex = 0;
                } else {
                    currentIndex = 1;
                }
                copy.layers[layerIndex].items.splice(currentIndex, 0, item);
                operations.push({
                    operation: 'delete',
                    path: ['layers', oldLayerIndex, 'items'],
                    position: oldIndex,
                    count: 1,
                });
                operations.push({
                    operation: 'insert',
                    path: ['layers', layerIndex, 'items'],
                    position: currentIndex,
                    items: [{ ...item }],
                });
            } else {
                const dx = Math.random() * 10 - 5;
                const item = copy.layers[layerIndex].items[currentIndex];
                item.start += dx;
                operations.push({
                    operation: 'set',
                    path: ['layers', layerIndex, 'items', currentIndex, 'start'],
                    value: item.start,
                });
            }
        }
        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
        expect(classResult).toEqual(copy);

    });

    it('Complex nested operations with splices and sets', () => {
        const initialObject = { items: [{ id: 1, paths: [{ points: [0, 1] }, { points: [0, 1] }, { points: [0, 1] }] }, { id: 1, paths: [{ points: [0, 1] }, { points: [0, 1] }, { points: [0, 1] }] }] };
        const operations: Operation[] = [];
        const copy = JSON.parse(JSON.stringify(initialObject));
        copy.items[0].paths[0].points[0] = 10;
        operations.push({
            operation: 'set',
            path: ['items', 0, 'paths', 0, 'points', 0],
            value: 10
        });
        copy.items[0].paths[1].points.splice(0, 1);
        operations.push({
            operation: 'delete',
            path: ['items', 0, 'paths', 1, 'points'],
            position: 0,
            count: 1
        });
        copy.items.splice(0, 1);
        operations.push({
            operation: 'delete',
            path: ['items'],
            position: 0,
            count: 1
        });
        copy.items[0].paths[0].points.splice(2, 0, 20);
        operations.push({
            operation: 'insert',
            path: ['items', 0, 'paths', 0, 'points'],
            position: 2,
            items: [20]
        });

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
        expect(classResult).toEqual(copy);
        expect(ops.setOperations).toEqual([]);
        expect(ops.spliceOperations).toEqual([
            {
                operation: 'delete',
                path: ['items'],
                position: 0,
                count: 1
            },
            {
                operation: 'insert',
                path: ['items', 0, 'paths', 0, 'points'],
                position: 2,
                items: [20]
            }
        ]);
    });

    it('Splice operations with nested arrays', () => {
        const initialObject = { items: [{ p: [0, 1] }, { p: [0, 1] }, { p: [0, 1] }] };
        const operations: Operation[] = [];
        const copy = JSON.parse(JSON.stringify(initialObject));
        copy.items[0].p.splice(0, 1);
        operations.push({
            operation: 'delete',
            path: ['items', 0, 'p'],
            position: 0,
            count: 1
        });
        copy.items[1].p.splice(2, 0, 20);
        operations.push({
            operation: 'insert',
            path: ['items', 1, 'p'],
            position: 2,
            items: [20]
        });
        copy.items.splice(0, 1);
        operations.push({
            operation: 'delete',
            path: ['items'],
            position: 0,
            count: 1
        });

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
        expect(classResult).toEqual(copy);
        expect(ops.setOperations).toEqual([]);
        expect(ops.spliceOperations).toEqual([
            {
                operation: 'insert',
                path: ['items', 1, 'p'],
                position: 2,
                items: [20]
            },
            {
                operation: 'delete',
                path: ['items'],
                position: 0,
                count: 1
            }
        ]);
    });

    it('Set operation in parent removes previous splice operation', () => {
        const initialObject = { items: [{ p: [0, 1] }, { p: [0, 1] }, { p: [0, 1] }] };
        const operations: Operation[] = [];
        const copy = JSON.parse(JSON.stringify(initialObject));
        copy.items[0].p.splice(0, 1);
        operations.push({
            operation: 'delete',
            path: ['items', 0, 'p'],
            position: 0,
            count: 1
        });
        copy.items[0] = { p: [0, 1, 2] };
        operations.push({
            operation: 'set',
            path: ['items', 0],
            value: { p: [0, 1, 2] }
        });

        // Use Operations class
        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Apply operations using the class with compacted operations
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Apply operations directly
        const originalResult = applier.applyOperations(initialObject, operations);

        // Compare results
        expect(classResult).toEqual(originalResult);
        expect(classResult).toEqual(copy);
        expect(ops.setOperations).toEqual([{
            operation: 'set',
            path: ['items', 0],
            value: { p: [0, 1, 2] }
        }]);
        expect(ops.spliceOperations).toEqual([]);
    });

    it('Test set operation on nested objects', () => {
        const initialObject = { user: { name: 'Alice', profile: { age: 30, city: 'New York' } }, posts: [] };

        const operations: Operation[] = [
            { operation: 'set', path: ['user', 'profile', 'city'], value: 'San Francisco' },
            { operation: 'set', path: ['user', 'profile', 'age'], value: 31 },
            { operation: 'set', path: ['user', 'name'], value: 'Alice Smith' },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test insert and delete operations on an array', () => {
        const initialObject = { cart: ['apple', 'banana', 'cherry'] };

        const operations: Operation[] = [
            { operation: 'insert', path: ['cart'], position: 1, items: ['orange', 'grape'] },
            { operation: 'delete', path: ['cart'], position: 2, count: 2 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test multiple overlapping deletes in an array', () => {
        const initialObject = { numbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };

        const operations: Operation[] = [
            { operation: 'delete', path: ['numbers'], position: 2, count: 3 },
            { operation: 'delete', path: ['numbers'], position: 4, count: 2 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test insert and delete operations in a nested array', () => {
        const initialObject = { messages: [{ text: 'Hello' }, { text: 'World' }, { text: '!' }] };

        const operations: Operation[] = [
            { operation: 'insert', path: ['messages'], position: 1, items: [{ text: 'Beautiful' }] },
            { operation: 'delete', path: ['messages'], position: 0, count: 1 },
            { operation: 'set', path: ['messages', 1, 'text'], value: 'Everyone' },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test set operations after insertions', () => {
        const initialObject = { users: [{ id: 1, name: 'John' }] };

        const operations: Operation[] = [
            { operation: 'insert', path: ['users'], position: 1, items: [{ id: 2, name: 'Doe' }] },
            { operation: 'set', path: ['users', 1, 'name'], value: 'Jane' },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test delete and set operations in deeply nested objects', () => {
        const initialObject = {
            config: {
                theme: { color: 'blue', font: 'Arial' },
                layout: { header: true, footer: true }
            }
        };

        const operations: Operation[] = [
            { operation: 'set', path: ['config', 'theme', 'color'], value: 'green' },
            { operation: 'set', path: ['config', 'theme', 'font'], value: 'Helvetica' },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test multiple set operations on the same property', () => {
        const initialObject = { settings: { volume: 50 } };

        const operations: Operation[] = [
            { operation: 'set', path: ['settings', 'volume'], value: 70 },
            { operation: 'set', path: ['settings', 'volume'], value: 30 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test complex operations with overlapping paths', () => {
        const initialObject = {
            document: {
                sections: [
                    { title: 'Introduction', content: '...' },
                    { title: 'Body', content: '...' },
                    { title: 'Conclusion', content: '...' },
                ]
            }
        };

        const operations: Operation[] = [
            { operation: 'insert', path: ['document', 'sections'], position: 1, items: [{ title: 'New Section', content: '...' }] },
            { operation: 'delete', path: ['document', 'sections'], position: 0, count: 1 },
            { operation: 'set', path: ['document', 'sections', 1, 'title'], value: 'Main Body' },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test deleting properties after setting them', () => {
        const initialObject = { profile: { username: 'user123', email: 'user@example.com' } };

        const operations: Operation[] = [
            { operation: 'set', path: ['profile', 'email'], value: 'newuser@example.com' },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test insert and delete operations in multi-level arrays', () => {
        const initialObject = {
            game: {
                players: [
                    { id: 1, score: 10 },
                    { id: 2, score: 20 },
                    { id: 3, score: 30 },
                ]
            }
        };

        const operations: Operation[] = [
            { operation: 'insert', path: ['game', 'players'], position: 2, items: [{ id: 4, score: 25 }] },
            { operation: 'delete', path: ['game', 'players'], position: 1, count: 2 },
            { operation: 'set', path: ['game', 'players', 0, 'score'], value: 15 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test deleting and inserting at the same position', () => {
        const initialObject = { list: ['a', 'b', 'c', 'd'] };

        const operations: Operation[] = [
            { operation: 'delete', path: ['list'], position: 1, count: 2 },
            { operation: 'insert', path: ['list'], position: 1, items: ['x', 'y'] },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test deleting non-existent elements', () => {
        const initialObject = { items: ['item1', 'item2'] };

        const operations: Operation[] = [
            { operation: 'delete', path: ['items'], position: 5, count: 2 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        let errorCaught = false;
        try {
            for (const op of operations) {
                ops.addOperation(op);
            }
            // Aplicar operações usando a classe com operações compactadas
            let classResult = initialObject;
            classResult = applier.applyOperations(classResult, ops.spliceOperations);
            classResult = applier.applyOperations(classResult, ops.setOperations);
        } catch (e) {
            errorCaught = true;
        }

        // Aplicar operações diretamente
        let originalResult;
        let originalErrorCaught = false;
        try {
            originalResult = applier.applyOperations(initialObject, operations);
        } catch (e) {
            originalErrorCaught = true;
        }

        // Comparar resultados
        expect(errorCaught).toEqual(originalErrorCaught);
    });

    it('Test sequential inserts and deletes with nested arrays', () => {
        const initialObject = { data: { items: [{ value: 1 }, { value: 2 }, { value: 3 }] } };

        const operations: Operation[] = [
            { operation: 'insert', path: ['data', 'items'], position: 1, items: [{ value: 4 }, { value: 5 }] },
            { operation: 'delete', path: ['data', 'items'], position: 2, count: 1 },
            { operation: 'set', path: ['data', 'items', 0, 'value'], value: 10 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Test operations on mixed data types', () => {
        const initialObject = { collection: [1, 'two', { three: 3 }] };

        const operations: Operation[] = [
            { operation: 'set', path: ['collection', 1], value: 'second' },
            { operation: 'insert', path: ['collection'], position: 2, items: [true, null] },
            { operation: 'delete', path: ['collection'], position: 0, count: 1 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Should handle set in parent and insert in child after', () => {
        const initialObject = { items: [{ id: 1, name: 'Alice' }] };

        const operations: Operation[] = [
            { operation: 'set', path: ['items'], value: [{ id: 2, name: 'Pedro' }, { id: 3, name: 'Bob' }] },
            { operation: 'insert', path: ['items'], position: 0, items: [{ id: 4, name: 'Francisca' }] },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        expect(ops.setOperations).toEqual([
            { operation: 'set', path: ['items'], value: [{ id: 4, name: 'Francisca' }, { id: 2, name: 'Pedro' }, { id: 3, name: 'Bob' }] }
        ]);
        expect(ops.spliceOperations).toEqual([]);

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Should handle set in parent and delete in child after', () => {
        const initialObject = { items: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] };

        const operations: Operation[] = [
            { operation: 'set', path: ['items'], value: [{ id: 3, name: 'Pedro' }, {id: 5, name: 'Cristiano'}] },
            { operation: 'delete', path: ['items'], position: 0, count: 1 },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        expect(ops.setOperations).toEqual([
            { operation: 'set', path: ['items'], value: [{id: 5, name: 'Cristiano'}] }
        ]);
        expect(ops.spliceOperations).toEqual([]);

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Should handle splice and set Parent after', () => {
        const initialObject = { items: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] };

        const operations: Operation[] = [
            { operation: 'delete', path: ['items'], position: 0, count: 1 },
            { operation: 'set', path: ['items'], value: [{ id: 3, name: 'Pedro' }, {id: 5, name: 'Cristiano'}] },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        expect(ops.setOperations).toEqual([
            { operation: 'set', path: ['items'], value: [{id: 3, name: 'Pedro'}, {id: 5, name: 'Cristiano'}] }
        ]);
        expect(ops.spliceOperations).toEqual([]);

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Should handle set parent and set child after', () => {
        const initialObject = { items: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] };

        const operations: Operation[] = [
            { operation: 'set', path: ['items'], value: [{ id: 3, name: 'Pedro' }, {id: 5, name: 'Cristiano'}] },
            { operation: 'set', path: ['items', 1, 'name'], value: 'Ronaldo' },
        ];

        const ops = new OperationsCompressor();
        const applier = new OperationsApplierJson();
        for (const op of operations) {
            ops.addOperation(op);
        }

        expect(ops.setOperations).toEqual([
            { operation: 'set', path: ['items'], value: [{id: 3, name: 'Pedro'}, {id: 5, name: 'Ronaldo'}] }
        ]);
        expect(ops.spliceOperations).toEqual([]);

        // Aplicar operações usando a classe com operações compactadas
        let classResult = initialObject;
        classResult = applier.applyOperations(classResult, ops.spliceOperations);
        classResult = applier.applyOperations(classResult, ops.setOperations);

        // Aplicar operações diretamente
        const originalResult = applier.applyOperations(initialObject, operations);

        // Comparar resultados
        expect(classResult).toEqual(originalResult);
    });

    it('Insert deeply nested item, delete at parent level and finally delete the inserted item', () => {
        let initialObject = {items: [{p: [0, 1]}, {p: [0, 1]}, {p: [0, 1]}]};
        const operations: Operation[] = [
            { operation: 'insert', path: ['items', 2, 'p'], position: 0, items: [2] },
            { operation: 'delete', path: ['items'], position: 0, count: 1 },
            { operation: 'delete', path: ['items', 1, 'p'], position: 0, count: 1 },
        ];

        const applier = new OperationsApplierJson();
        const ops = new OperationsCompressor();
        for (const op of operations) {
            ops.addOperation(op);
        }
        expect(ops.spliceOperations).toEqual([
            { operation: 'delete', path: ['items'], position: 0, count: 1 },
        ]);

        const classResult = applier.applyOperations(initialObject, ops.spliceOperations);
        const originalResult = applier.applyOperations(initialObject, operations);
        expect(classResult).toEqual(originalResult);
    });
    it('Insert deeply nested item, perform operations on parent, and finally delete the inserted item', () => {
        let initialObject = {items: [{p: [0, 1]}, {p: [0, 1]}, {p: [0, 1]}]};
        const operations: Operation[] = [
            { operation: 'insert', path: ['items', 2, 'p'], position: 0, items: [2] },
            { operation: 'delete', path: ['items'], position: 0, count: 1 },
            { operation: 'insert', path: ['items', 1, 'p'], position: 2, items: [3] },
            { operation: 'insert', path: ['items'], position: 2, items: [{p: [0, 1]}] },
            { operation: 'insert', path: ['items'], position: 1, items: [{p: [0, 1]}, {p: [0, 1]}] },
            { operation: 'delete', path: ['items', 3, 'p'], position: 0, count: 1 },
        ];

        const applier = new OperationsApplierJson();
        const ops = new OperationsCompressor();
        for (const op of operations) {
            ops.addOperation(op);
        }
        expect(ops.spliceOperations).toEqual([
            { operation: 'delete', path: ['items'], position: 0, count: 1 },
            { operation: 'insert', path: ['items', 1, 'p'], position: 1, items: [3] },
            { operation: 'insert', path: ['items'], position: 2, items: [{p: [0, 1]}] },
            { operation: 'insert', path: ['items'], position: 1, items: [{p: [0, 1]}, {p: [0, 1]}] },
        ]);

        const classResult = applier.applyOperations(initialObject, ops.spliceOperations);
        const originalResult = applier.applyOperations(initialObject, operations);
        expect(classResult).toEqual(originalResult);
    });
    


});
