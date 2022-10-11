# Ymmutable

Mix between @syncedstore and Automerge. Using yjs in background.


```typescript
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
});

expect(store.immutable.someObject).equal({hello: 'World!'});
expect(store.immutable.todoList).equal([{descript: 'Share this with the World', done: false}]);

store.mutate(data => {
  data.todoList[0].done = true;
});

expect(store.immutable.todoList).equal([{descript: 'Share this with the World', done: true}]);

store.undoManager.undo();

expect(store.immutable.todoList).equal([{descript: 'Share this with the World', done: false}]);

store.undoManager.undo();
expect(store.immutable.someObject).equal({});
expect(store.immutable.todoList).equal([]);
```
