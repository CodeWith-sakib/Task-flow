import { IndexCursor } from '../../src/storage/IndexCursor';

describe('IndexCursor', () => {
  it('should traverse items forward and backward and seek', () => {
    const items = [
      { key: 'b', value: 2 },
      { key: 'a', value: 1 },
      { key: 'c', value: 3 }
    ];
    const cursor = new IndexCursor(items);

    expect(cursor.next()?.key).toBe('a');
    expect(cursor.next()?.key).toBe('b');

    cursor.seek('c');
    expect(cursor.next()?.key).toBe('c');
    expect(cursor.hasNext()).toBe(false);
  });
});
