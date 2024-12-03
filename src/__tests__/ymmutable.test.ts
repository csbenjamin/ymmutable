import { Ymmutable } from '..'; // Ajuste o caminho conforme necessário
import { YMultiDocUndoManager } from 'y-utility/y-multidoc-undomanager';
import * as Y from 'yjs';
import { jest } from '@jest/globals';

jest.useFakeTimers();

interface TestData {
    foo?: string;
    bar?: number;
    nested?: {
        baz?: boolean;
        [key: string]: any; // Permite outras propriedades
    };
    list?: any[];
    buffer?: Uint8Array;
    a?: number;
    b?: number;
    c?: number;
    yText?: Y.Text;
    [key: string]: any; // Permite outras propriedades
}

describe('Ymmutable', () => {
    let ymmutable: Ymmutable<TestData>;
    let undoManager: YMultiDocUndoManager;

    beforeEach(() => {
        undoManager = new YMultiDocUndoManager();
        ymmutable = new Ymmutable({ undoManager });
    });

    afterEach(() => {
        ymmutable.destroy();
    });

    it('should initialize with empty immutable object', () => {
        expect(ymmutable.immutable).toEqual({});
    });

    it('mutate method should update immutable object', () => {
        ymmutable.mutate((d) => {
            d.foo = 'bar';
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable).toEqual({ foo: 'bar' });
    });

    it('change observable should emit correct old and new values', () => {
        const changeSpy = jest.fn();
        ymmutable.change.subscribe(changeSpy);

        ymmutable.mutate((d) => {
            d.foo = 'bar';
        });

        jest.advanceTimersByTime(2000);
        jest.runAllTimers();

        expect(changeSpy).toHaveBeenCalledTimes(1);
        expect(changeSpy).toHaveBeenCalledWith({
            currentValue: { foo: 'bar' },
            oldValue: {},
        });
    });

    it('setRoot method should set the root data', () => {
        ymmutable.setRoot({ foo: 'bar', bar: 42 });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable).toEqual({ foo: 'bar', bar: 42 });
    });

    it('applyUpdates should apply updates from another instance', () => {
        const ymmutable2 = new Ymmutable<TestData>({ undoManager });

        const updates: Uint8Array[] = [];
        ymmutable.onUpdate.subscribe((update) => {
            updates.push(update);
        });

        ymmutable.mutate((d) => {
            d.foo = 'bar';
        });

        jest.advanceTimersByTime(2000);

        ymmutable2.applyUpdates(updates);

        jest.advanceTimersByTime(2000);

        expect(ymmutable2.immutable).toEqual({ foo: 'bar' });

        ymmutable2.destroy();
    });

    it('getStateVector and encodeState should return correct values', () => {
        ymmutable.mutate((d) => {
            d.foo = 'bar';
        });

        jest.advanceTimersByTime(2000);

        const stateVector = ymmutable.getStateVector();
        const encodedState = ymmutable.encodeState();

        expect(stateVector).toBeInstanceOf(Uint8Array);
        expect(encodedState).toBeInstanceOf(Uint8Array);

        const doc = new Y.Doc();
        Y.applyUpdateV2(doc, encodedState);

        expect(doc.getMap().toJSON()).toEqual({ foo: 'bar' });
    });

    it('destroy method should clean up', () => {
        const onUpdateSpy = jest.fn();
        ymmutable.onUpdate.subscribe(onUpdateSpy);

        ymmutable.destroy();

        ymmutable.mutate((d) => {
            d.foo = 'bar';
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable).toEqual({});
        expect(onUpdateSpy).not.toHaveBeenCalled();
    });

    it('applyUpdates with empty array should not throw', () => {
        expect(() => ymmutable.applyUpdates([])).not.toThrow();
    });

    it('should respect custom debounceDuration', async () => {
        ymmutable = new Ymmutable({ undoManager, debounceDuration: 500 });

        const onUpdateSpy = jest.fn();
        ymmutable.onUpdate.subscribe(onUpdateSpy);
        const changeSpy = jest.fn();
        ymmutable.change.subscribe(changeSpy);

        ymmutable.mutate((d) => {
            d.foo = 'bar';
        });

        // 'immutable' é atualizado imediatamente
        expect(ymmutable.immutable).toEqual({ foo: 'bar' });

        // Avançar o tempo menos que debounceDuration
        jest.advanceTimersByTime(499);

        // 'changeSubject' emite antes do debounceDuration
        expect(changeSpy).toHaveBeenCalledTimes(1);




        // Nenhuma atualização deve ter sido emitida para onUpdate
        expect(onUpdateSpy).toHaveBeenCalledTimes(0);

        // Avançar o tempo para alcançar debounceDuration
        jest.advanceTimersByTime(1);

        // Agora as modificações em Y.Doc devem ser aplicadas e 'onUpdate' deve emitir
        expect(onUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('onUpdate should emit updates when local changes are made', () => {
        const onUpdateSpy = jest.fn();
        ymmutable.onUpdate.subscribe(onUpdateSpy);

        ymmutable.mutate((d) => {
            d.foo = 'bar';
        });

        jest.advanceTimersByTime(2000);

        expect(onUpdateSpy).toHaveBeenCalledTimes(1);
        const update = onUpdateSpy.mock.calls[0][0];
        expect(update).toBeInstanceOf(Uint8Array);
    });

    it('should queue incoming updates if there is a pending local change', () => {
        const ymmutable2 = new Ymmutable<TestData>({ undoManager });

        const updates2: Uint8Array[] = [];
        ymmutable2.onUpdate.subscribe((update) => {
            updates2.push(update);
        });

        ymmutable.mutate((d) => {
            d.foo = 'bar';
        });

        ymmutable2.mutate((d) => {
            d.bar = 42;
        });

        jest.advanceTimersByTime(2000);

        ymmutable.applyUpdates(updates2);

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable).toEqual({ foo: 'bar', bar: 42 });

        ymmutable2.destroy();
    });

    it('should handle array mutations correctly', () => {
        ymmutable.mutate((d) => {
            d.list = [1, 2, 3];
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable.list).toEqual([1, 2, 3]);

        ymmutable.mutate((d) => {
            if (d.list) {
                d.list.push(4);
            }
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable.list).toEqual([1, 2, 3, 4]);
    });

    it('should handle nested object mutations correctly', () => {
        ymmutable.mutate((d) => {
            d.nested = { baz: true };
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable.nested).toEqual({ baz: true });

        ymmutable.mutate((d) => {
            if (d.nested) {
                d.nested.baz = false;
            }
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable.nested).toEqual({ baz: false });
    });

    it('should coalesce multiple mutations within debounceDuration', () => {
        const onUpdate = jest.fn();
        ymmutable.onUpdate.subscribe(onUpdate);
        const changeSpy = jest.fn();
        ymmutable.change.subscribe(changeSpy);

        ymmutable.mutate((d) => {
            d.foo = 'first';
        });

        ymmutable.mutate((d) => {
            d.bar = 42;
        });

        jest.advanceTimersByTime(1);

        expect(changeSpy).toHaveBeenCalledWith({
            currentValue: { foo: 'first', bar: 42 },
            oldValue: {},
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable).toEqual({ foo: 'first', bar: 42 });

        jest.runAllTimers();

        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('should emit separate changes when mutations occur after debounceDuration', () => {
        const changeSpy = jest.fn();
        ymmutable.change.subscribe(changeSpy);

        ymmutable.mutate((d) => {
            d.foo = 'first';
        });

        jest.advanceTimersByTime(2000);
        jest.runAllTimers();

        expect(ymmutable.immutable).toEqual({ foo: 'first' });
        expect(changeSpy).toHaveBeenCalledTimes(1);
        expect(changeSpy).toHaveBeenCalledWith({
            currentValue: { foo: 'first' },
            oldValue: {},
        });

        ymmutable.mutate((d) => {
            d.bar = 42;
        });

        jest.advanceTimersByTime(2000);
        jest.runAllTimers();

        expect(ymmutable.immutable).toEqual({ foo: 'first', bar: 42 });
        expect(changeSpy).toHaveBeenCalledTimes(2);
        expect(changeSpy.mock.calls[1][0]).toEqual({
            currentValue: { foo: 'first', bar: 42 },
            oldValue: { foo: 'first' },
        });
    });

    it('should be able to undo mutations using undoManager', () => {
        ymmutable.mutate((d) => {
            d.foo = 'test';
            d.yText = new Y.Text();
        });

        jest.advanceTimersByTime(2000);
        jest.runAllTimers();

        expect(ymmutable.immutable.foo).toEqual('test');

        undoManager.undo();

        jest.advanceTimersByTime(0);
        jest.runAllTimers();

        expect(ymmutable.immutable).toEqual({});

        undoManager.redo();

        jest.advanceTimersByTime(0);
        jest.runAllTimers();

        expect(ymmutable.immutable.foo).toEqual('test');

        const yText = ymmutable.immutable.yText as Y.Text;
        expect(yText).toBeInstanceOf(Y.Text);

        yText.insert(0, 'hello');

        expect(ymmutable.immutable.yText!.toString()).toEqual('hello');

        undoManager.undo();

        expect(ymmutable.immutable.yText!.toString()).toEqual('');
    });

    it('should work with generic type parameter S', () => {
        const ymmutableTyped = new Ymmutable<TestData>({ undoManager });

        ymmutableTyped.mutate((d) => {
            d.foo = 'hello';
            d.bar = 42;
            d.nested = { baz: true };
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutableTyped.immutable).toEqual({
            foo: 'hello',
            bar: 42,
            nested: { baz: true },
        });
    });

    it('mutate after destroy should do nothing', () => {
        ymmutable.destroy();

        ymmutable.mutate((d) => {
            d.foo = 'bar';
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable).toEqual({});
    });

    it('should handle multiple mutations correctly', () => {
        ymmutable.mutate((d) => {
            d.foo = 'foo';
        });

        ymmutable.mutate((d) => {
            d.bar = 42;
        });

        ymmutable.mutate((d) => {
            d.nested = { baz: true };
        });

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable).toEqual({ foo: 'foo', bar: 42, nested: { baz: true } });
    });

    it('should handle large objects', () => {
        const largeObject: TestData = {};
        for (let i = 0; i < 1000; i++) {
            largeObject[`key${i}`] = i;
        }

        ymmutable.setRoot(largeObject);

        jest.advanceTimersByTime(2000);

        expect(ymmutable.immutable).toEqual(largeObject);
    });

    it('should handle simultaneous mutations and updates', () => {
        const ymmutable2 = new Ymmutable<TestData>({ undoManager });

        const updates1: Uint8Array[] = [];
        const updates2: Uint8Array[] = [];

        ymmutable.onUpdate.subscribe((update) => {
            updates1.push(update);
        });

        ymmutable2.onUpdate.subscribe((update) => {
            updates2.push(update);
        });

        ymmutable.mutate((d) => {
            d.foo = 'foo1';
        });

        ymmutable2.mutate((d) => {
            d.bar = 42;
        });

        jest.advanceTimersByTime(2000);

        ymmutable.applyUpdates(updates2);
        ymmutable2.applyUpdates(updates1);

        jest.advanceTimersByTime(2000);

        // Both properties should be present without conflict
        expect(ymmutable.immutable).toEqual({ foo: 'foo1', bar: 42 });
        expect(ymmutable2.immutable).toEqual({ foo: 'foo1', bar: 42 });

        ymmutable2.destroy();
    });

    it('should handle todo list mutations correctly', () => {
        const updates: Uint8Array[] = [];
        ymmutable.onUpdate.subscribe((update) => {
            updates.push(update);
        });
        ymmutable.mutate(d => {
            d.todos = [];
        });
        jest.advanceTimersByTime(2000);
        expect(updates.length).toBe(1);
        expect(ymmutable.immutable.todos).toEqual([]);
        ymmutable.mutate(d => {
            d.todos.push({ id: 1, text: 'Buy milk', checked: false });
        });
        jest.advanceTimersByTime(2000);
        expect(updates.length).toBe(2);
        expect(ymmutable.immutable.todos).toEqual([{ id: 1, text: 'Buy milk', checked: false }]);
        ymmutable.mutate(d => {
            const todo = d.todos.find((t: any) => t.id === 1);
            if (todo) {
                todo.checked = true;
            }
        });
        jest.advanceTimersByTime(2000);
        expect(updates.length).toBe(3);
        expect(ymmutable.immutable.todos).toEqual([{ id: 1, text: 'Buy milk', checked: true }]);

        jest.runAllTimers();

        // check the yMap in ymmutable yDoc
        const yMap = ymmutable['doc'].getMap();
        expect((yMap.get('todos') as any).toJSON()).toEqual([{ id: 1, text: 'Buy milk', checked: true }]);
    });

    it('should handle multiple todo items correctly', () => {
        ymmutable.mutate(d => {
            d.todos = [];
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([]);
        ymmutable.mutate(d => {
            d.todos.push({ id: 1, text: 'Buy milk', checked: false });
            d.todos.push({ id: 2, text: 'Walk the dog', checked: false });
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([
            { id: 1, text: 'Buy milk', checked: false },
            { id: 2, text: 'Walk the dog', checked: false }
        ]);
    });

    it('should handle removing todo items correctly', () => {
        ymmutable.mutate(d => {
            d.todos = [{ id: 1, text: 'Buy milk', checked: false }];
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([{ id: 1, text: 'Buy milk', checked: false }]);
        ymmutable.mutate(d => {
            d.todos = d.todos.filter((t: any) => t.id !== 1);
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([]);
    });

    it('should handle toggling todo items correctly', () => {
        ymmutable.mutate(d => {
            d.todos = [{ id: 1, text: 'Buy milk', checked: false }];
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([{ id: 1, text: 'Buy milk', checked: false }]);
        ymmutable.mutate(d => {
            const todo = d.todos.find((t: any) => t.id === 1);
            if (todo) {
                todo.checked = !todo.checked;
            }
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([{ id: 1, text: 'Buy milk', checked: true }]);
        ymmutable.mutate(d => {
            const todo = d.todos.find((t: any) => t.id === 1);
            if (todo) {
                todo.checked = !todo.checked;
            }
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([{ id: 1, text: 'Buy milk', checked: false }]);
    });

    it('should handle clearing all todo items correctly', () => {
        ymmutable.mutate(d => {
            d.todos = [
                { id: 1, text: 'Buy milk', checked: false },
                { id: 2, text: 'Walk the dog', checked: false }
            ];
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([
            { id: 1, text: 'Buy milk', checked: false },
            { id: 2, text: 'Walk the dog', checked: false }
        ]);
        ymmutable.mutate(d => {
            d.todos = [];
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([]);
    });

    it('should wait to apply external updates if there is a pending debounce', () => {
        const localUpdates: Uint8Array[] = [];
        const externalDoc = new Y.Doc();
        const ymmutableApplyUpdatesSpy = jest.spyOn(ymmutable, 'applyUpdates');
        ymmutable.onUpdate.subscribe(update => {
            localUpdates.push(update);
            Y.applyUpdateV2(externalDoc, update);
        });
        ymmutable.mutate(d => {
            d.todos = [];
        });
        jest.advanceTimersByTime(2000);
        expect(localUpdates.length).toBe(1);

        externalDoc.on('updateV2', (update) => {
            ymmutable.applyUpdates([update]);
        });
        Y.applyUpdateV2(externalDoc, localUpdates[0]);
        const yMap = externalDoc.getMap();
        const todoArray = yMap.get('todos') as Y.Array<any>;
        ymmutable.mutate(d => {
            d.todos.push({ id: 1, text: 'Buy milk', checked: false });
        });
        const newTodo = new Y.Map();
        newTodo.set('id', 2);
        newTodo.set('text', 'Walk the dog');
        newTodo.set('checked', false);
        todoArray.push([newTodo]);
        expect(ymmutableApplyUpdatesSpy).toHaveBeenCalledTimes(1);
        expect(ymmutable.immutable.todos).toEqual([
            { id: 1, text: 'Buy milk', checked: false }
        ]);
        expect(todoArray.toJSON()).toEqual([
            { id: 2, text: 'Walk the dog', checked: false }
        ]);
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos.length).toBe(2);
        const todo1 = ymmutable.immutable.todos.find((t: any) => t.id === 1);
        const todo2 = ymmutable.immutable.todos.find((t: any) => t.id === 2);
        expect([todo1, todo2]).toEqual([
            { id: 1, text: 'Buy milk', checked: false },
            { id: 2, text: 'Walk the dog', checked: false }
        ]);
        const externalTodos = todoArray.toJSON();
        expect(externalTodos.length).toBe(2);
        const externalTodo1 = externalTodos.find((t: any) => t.id === 1);
        const externalTodo2 = externalTodos.find((t: any) => t.id === 2);
        expect([externalTodo1, externalTodo2]).toEqual([
            { id: 1, text: 'Buy milk', checked: false },
            { id: 2, text: 'Walk the dog', checked: false }
        ]);

    });

    it('external doc should mark a todo as checked', () => {
        const localUpdates: Uint8Array[] = [];
        const externalDoc = new Y.Doc();
        ymmutable.onUpdate.subscribe(update => {
            localUpdates.push(update);
            Y.applyUpdateV2(externalDoc, update);
        });
        ymmutable.mutate(d => {
            d.todos = [];
        });
        jest.advanceTimersByTime(2000);
        expect(localUpdates.length).toBe(1);

        externalDoc.on('updateV2', (update) => {
            ymmutable.applyUpdates([update]);
        });
        Y.applyUpdateV2(externalDoc, localUpdates[0]);
        const yMap = externalDoc.getMap();
        const todoArray = yMap.get('todos') as Y.Array<any>;
        ymmutable.mutate(d => {
            d.todos.push({ id: 1, text: 'Buy milk', checked: false });
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([
            { id: 1, text: 'Buy milk', checked: false },
        ]);
        const externalTodos = todoArray.toJSON();
        expect(externalTodos).toEqual([
            { id: 1, text: 'Buy milk', checked: false }
        ]);

        const todo = todoArray.toArray().find((t: any) => t.get('id') === 1);
        const ymmutableApplyUpdatesSpy = jest.spyOn(ymmutable, 'applyUpdates');
        todo.set('checked', true);
        expect(ymmutableApplyUpdatesSpy).toHaveBeenCalledTimes(1);
        expect(ymmutable.immutable.todos).toEqual([
            { id: 1, text: 'Buy milk', checked: true },
        ]);

    });

    it('external doc should mark a todo as checked', () => {
        const localUpdates: Uint8Array[] = [];
        const externalDoc = new Y.Doc();
        ymmutable.onUpdate.subscribe(update => {
            localUpdates.push(update);
            Y.applyUpdateV2(externalDoc, update);
        });
        ymmutable.mutate(d => {
            d.todos = [];
        });
        jest.advanceTimersByTime(2000);
        expect(localUpdates.length).toBe(1);

        externalDoc.on('updateV2', (update) => {
            ymmutable.applyUpdates([update]);
        });
        Y.applyUpdateV2(externalDoc, localUpdates[0]);
        const yMap = externalDoc.getMap();
        const todoArray = yMap.get('todos') as Y.Array<any>;
        ymmutable.mutate(d => {
            d.todos.push(
                { id: 1, text: 'Buy milk', checked: false },
                { id: 2, text: 'Walk the dog', checked: false },
                { id: 3, text: 'Clean the house', checked: false },
                { id: 4, text: 'Do homework', checked: false },
                { id: 5, text: 'Go to the gym', checked: false }
            );
        });
        jest.advanceTimersByTime(2000);
        expect(ymmutable.immutable.todos).toEqual([
            { id: 1, text: 'Buy milk', checked: false },
            { id: 2, text: 'Walk the dog', checked: false },
            { id: 3, text: 'Clean the house', checked: false },
            { id: 4, text: 'Do homework', checked: false },
            { id: 5, text: 'Go to the gym', checked: false }
        ]);
        const externalTodos = todoArray.toJSON();
        expect(externalTodos).toEqual([
            { id: 1, text: 'Buy milk', checked: false },
            { id: 2, text: 'Walk the dog', checked: false },
            { id: 3, text: 'Clean the house', checked: false },
            { id: 4, text: 'Do homework', checked: false },
            { id: 5, text: 'Go to the gym', checked: false }
        ]);

        const ymmutableApplyUpdatesSpy = jest.spyOn(ymmutable, 'applyUpdates');

        externalDoc.transact(() => {
            todoArray.delete(1, 2);
        });
        expect(ymmutableApplyUpdatesSpy).toHaveBeenCalledTimes(1);
        expect(ymmutable.immutable.todos).toEqual([
            { id: 1, text: 'Buy milk', checked: false },
            { id: 4, text: 'Do homework', checked: false },
            { id: 5, text: 'Go to the gym', checked: false }
        ]);

    });
});
