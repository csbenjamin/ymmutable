# Ymmutable

Mix between @syncedstore and Automerge. Using yjs in background.


```typescript
import * as Y from 'yjs';
import {Ymmutable} from '@csbenjamin/ymmutable'

interface MyAmazingData {
  someObject: {hello: string};
  todoList: {description: string, done: boolean}[];
}
let store = Ymmutable<MyAmazingData>({someObject: 'object', todoList: 'array'});

expect(store.immutable.someObject).equal({});
expect(store.immutable.todoList).equal([]);
expect(store.doc instanceof Y.Doc).toBe(true);
expect(store.undoManager instanceof Y.UndoManager).toBe(true);

store.mutate(data => {
  data.someObject.hello = 'World!';
  data.todoList.push({descript: 'Share this with the World', done: false});
  data.todoList.push({descript: 'Share this with the World 2', done: false});
});

expect(store.immutable.someObject).equal({hello: 'World!'});
expect(store.immutable.todoList[0]).equal([{descript: 'Share this with the World', done: false}]);

const oldImmutable = store.immutable;

store.mutate(data => {
  data.todoList[0].done = true;
});

expect(store.immutable.todoList[0]).equal([{descript: 'Share this with the World', done: true}]);
expect(store.immutable === oldImmutable).toBe(false);
expect(store.immutable.someObject === oldImmutable.someObject).toBe(true);
expect(store.immutable.todoList === oldImmutable.todoList).toBe(false);
expect(store.immutable.todoList[0] === oldImmutable.todoList[0]).toBe(false);
expect(store.immutable.todoList[1] === oldImmutable.todoList[1]).toBe(true);

store.undoManager.undo();

expect(store.immutable.todoList[0]).equal([{descript: 'Share this with the World', done: false}]);

store.undoManager.undo();
expect(store.immutable.someObject).equal({});
expect(store.immutable.todoList).equal([]);
```
