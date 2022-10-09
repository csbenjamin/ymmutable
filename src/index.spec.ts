import { describe, expect, test } from '@jest/globals';
import { Ymmutable } from './index';

describe('Basics', () => {
  test('Initialization', () => {
    const store = Ymmutable<{ todo: { name: string; done: boolean }[]; settings: { public: boolean } }>({
      todo: 'array',
      settings: 'object',
    });
    expect(store.immutable.todo).toBeDefined();
    expect(store.immutable.todo instanceof Array).toBe(true);
    expect(store.immutable.todo.length).toBe(0);
    expect(store.immutable.settings).toBeDefined();
    expect(store.immutable.settings.public).toBeUndefined();
  });
  test('Update object in root', () => {
    const store = Ymmutable<{ todo: { name: string; done: boolean }[]; settings: { public: boolean } }>({
      todo: 'array',
      settings: 'object',
    });
    const immutable = store.immutable;
    store.mutate((doc) => {
      doc.settings.public = true;
    });
    expect(store.immutable).not.toEqual(immutable);
    expect(immutable.settings.public).toBeUndefined();
    expect(store.immutable.settings.public).toBe(true);
  });
  test('Update array in root', () => {
    const store = Ymmutable<{ todo: { name: string; done: boolean }[]; settings: { public: boolean } }>({
      todo: 'array',
      settings: 'object',
    });
    let immutable = store.immutable;
    store.mutate((doc) => {
      doc.todo.push({ name: 'Hello', done: false });
    });
    expect(store.immutable).not.toEqual(immutable);
    expect(store.immutable.todo.length).toBe(1);
    expect(immutable.todo.length).toBe(0);
    expect(store.immutable.todo[0].name).toBe('Hello');
    expect(store.immutable.todo[0].done).toBe(false);
    immutable = store.immutable;
    store.mutate((doc) => {
      doc.todo[0].done = true;
    });
    expect(store.immutable.todo[0].done).toBe(true);
    expect(store.immutable).not.toEqual(immutable);
    expect(store.immutable.settings).toEqual(immutable.settings);
    expect(store.immutable.todo).not.toEqual(immutable.todo);
    expect(store.immutable.todo[0]).not.toEqual(immutable.todo[0]);
    expect(immutable.todo[0].done).toBe(false);
  });
});
