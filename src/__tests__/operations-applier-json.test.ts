import { OperationsApplierJson, Operation } from '..';

describe('OperationsApplierJson', () => {
  let applier: OperationsApplierJson;

  beforeEach(() => {
    applier = new OperationsApplierJson();
  });

  it('deve aplicar uma única operação de set na raiz', () => {
    const obj = { a: 1 };
    const operations: Operation[] = [
      { operation: 'set', path: [], value: { b: 2 } },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ b: 2 });
  });
  it('Não deve aplicar splice em algo que não é array', () => {
    const obj = { a: null };
    const operations: Operation[] = [
      { operation: 'delete', path: ['a'], position: 0, count: 1 },
    ];
    expect(() => applier.applyOperations(obj, operations)).toThrow(
      'Target is not an array at path '
    );
  });

  it('deve aplicar uma única operação de set em um caminho aninhado', () => {
    const obj = { a: { b: 1 } };
    const operations: Operation[] = [
      { operation: 'set', path: ['a', 'b'], value: 2 },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ a: { b: 2 } });
  });

  it('deve aplicar múltiplas operações de set', () => {
    const obj = { a: { b: 1 }, c: 3 };
    const operations: Operation[] = [
      { operation: 'set', path: ['a', 'b'], value: 2 },
      { operation: 'set', path: ['c'], value: 4 },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ a: { b: 2 }, c: 4 });
  });

  it('deve aplicar operação de set em índice de array', () => {
    const obj = { arr: [1, 2, 3] };
    const operations: Operation[] = [
      { operation: 'set', path: ['arr', 1], value: 5 },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ arr: [1, 5, 3] });
  });

  it('deve aplicar operação de splice em um array', () => {
    const obj = { arr: [1, 2, 3, 4] };
    const operations: Operation[] = [
      { operation: 'delete', path: ['arr'], position: 1, count: 2 },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ arr: [1, 4] });
  });

  it('deve aplicar operação de splice e inserir itens', () => {
    const obj = { arr: [1, 2, 3, 4] };
    const operations: Operation[] = [
      { operation: 'delete', path: ['arr'], position: 1, count: 2 },
      { operation: 'insert', path: ['arr'], position: 1, items: ['a', 'b'] },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ arr: [1, 'a', 'b', 4] });
  });

  it('deve aplicar múltiplas operações de splice', () => {
    const obj = { arr: [1, 2, 3, 4] };
    const operations: Operation[] = [
      { operation: 'delete', path: ['arr'], position: 0, count: 1 },
      { operation: 'delete', path: ['arr'], position: 2, count: 1 },
      { operation: 'insert', path: ['arr'], position: 2, items: [5, 6] },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ arr: [2, 3, 5, 6] });
  });

  it('deve combinar operações de set e splice', () => {
    const obj = { arr: [1, 2, 3], a: { b: 1 } };
    const operations: Operation[] = [
      { operation: 'set', path: ['a', 'b'], value: 2 },
      { operation: 'delete', path: ['arr'], position: 1, count: 1 },
      { operation: 'insert', path: ['arr'], position: 1, items: [4, 5] },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ arr: [1, 4, 5, 3], a: { b: 2 } });
  });

  it('deve lançar erro ao tentar definir propriedade em não-objeto', () => {
    const obj = { a: null };
    const operations: Operation[] = [
      { operation: 'set', path: ['a', 'b'], value: 2 },
    ];
    expect(() => applier.applyOperations(obj, operations)).toThrow(
      'Cannot set property b on non-object'
    );
  });

  it('deve lançar erro ao tentar aplicar splice em não-array', () => {
    const obj = { a: 1 };
    const operations: Operation[] = [
      { operation: 'delete', path: ['a'], position: 0, count: 1 },
    ];
    expect(() => applier.applyOperations(obj, operations)).toThrow(
      'Target is not an array at path a'
    );
  });

  it('deve lidar com operações de set profundamente aninhadas', () => {
    const obj = { a: { b: { c: { d: 1 } } } };
    const operations: Operation[] = [
      { operation: 'set', path: ['a', 'b', 'c', 'd'], value: 2 },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ a: { b: { c: { d: 2 } } } });
  });

  it('deve adicionar nova propriedade em um objeto', () => {
    const obj = { a: {} };
    const operations: Operation[] = [
      { operation: 'set', path: ['a', 'newProp'], value: 'value' },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ a: { newProp: 'value' } });
  });

  it('deve adicionar novo índice em um array', () => {
    const obj = { arr: [1, 2, 3] };
    const operations: Operation[] = [
      { operation: 'set', path: ['arr', 3], value: 4 },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ arr: [1, 2, 3, 4] });
  });

  it('não deve mutar o objeto original', () => {
    const obj = { a: { b: 1 } };
    const objCopy = JSON.parse(JSON.stringify(obj));
    const operations: Operation[] = [
      { operation: 'set', path: ['a', 'b'], value: 2 },
    ];
    applier.applyOperations(obj, operations);
    expect(obj).toEqual(objCopy);
  });

  it('deve lidar com array de operações vazio', () => {
    const obj = { a: 1 };
    const operations: Operation[] = [];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ a: 1 });
  });

  it('não deve lidar com operações em caminhos indefinidos', () => {
    const obj = {};
    const operations: Operation[] = [
      { operation: 'set', path: ['a', 'b', 'c'], value: 1 },
    ];
    expect(() => applier.applyOperations(obj, operations)).toThrow(
      'Cannot set property b on non-object'
    );
  });

  it('deve lançar erro quando o caminho é inválido na operação de splice', () => {
    const obj = { arr: [1, 2, 3] };
    const operations: Operation[] = [
      { operation: 'delete', path: ['arr', 'nonArray'], position: 0, count: 1 },
    ];
    expect(() => applier.applyOperations(obj, operations)).toThrow(
      'Target is not an array at path arr.nonArray'
    );
  });

  it('deve lidar com operação de splice apenas com índice inicial', () => {
    const obj = { arr: [1, 2, 3, 4] };
    const operations: Operation[] = [
      { operation: 'delete', path: ['arr'], position: 2, count: 2 },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ arr: [1, 2] });
  });

  it('deve lidar com operação de splice com índices negativos', () => {
    const obj = { arr: [1, 2, 3, 4, 5] };
    const operations: Operation[] = [
      { operation: 'delete', path: ['arr'], position: 3, count: 1 },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ arr: [1, 2, 3, 5] });
  });

  it('deve lidar com combinação complexa de operações', () => {
    const obj = { a: { b: [1, 2, 3] }, c: 4 };
    const operations: Operation[] = [
      { operation: 'set', path: ['a', 'd'], value: 'new' },
      { operation: 'delete', path: ['a', 'b'], position: 1, count: 1 },
      { operation: 'insert', path: ['a', 'b'], position: 1, items: ['x'] },
      { operation: 'set', path: ['e'], value: { f: 'g' } },
    ];
    const result = applier.applyOperations(obj, operations);
    expect(result).toEqual({ a: { b: [1, 'x', 3], d: 'new' }, c: 4, e: { f: 'g' } });
  });
});
