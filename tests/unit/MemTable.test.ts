import { MemTable } from '../../src/storage/MemTable';

describe('MemTable', () => {
  let memTable: MemTable<string>;

  beforeEach(() => {
    memTable = new MemTable<string>(1024);
  });

  it('should set and get values correctly', () => {
    memTable.set('user:101', 'Alice');
    memTable.set('user:102', 'Bob');

    expect(memTable.get('user:101')).toBe('Alice');
    expect(memTable.get('user:102')).toBe('Bob');
    expect(memTable.get('user:999')).toBeUndefined();
    expect(memTable.has('user:101')).toBe(true);
    expect(memTable.has('user:999')).toBe(false);
  });

  it('should mark deleted entries as tombstones and exclude them from gets', () => {
    memTable.set('key1', 'val1');
    expect(memTable.has('key1')).toBe(true);

    const deleted = memTable.delete('key1');
    expect(deleted).toBe(true);
    expect(memTable.has('key1')).toBe(false);
    expect(memTable.get('key1')).toBeUndefined();
    expect(memTable.delete('non_existent')).toBe(false);
  });

  it('should scan keys in sorted order with range filtering', () => {
    memTable.set('c', 'charlie');
    memTable.set('a', 'alice');
    memTable.set('b', 'bob');
    memTable.set('d', 'david');

    const all = memTable.scan();
    expect(all.map(e => e.key)).toEqual(['a', 'b', 'c', 'd']);

    const range = memTable.scan('b', 'c');
    expect(range.map(e => e.key)).toEqual(['b', 'c']);
  });

  it('should track byte size and flush entries', () => {
    memTable.set('k1', 'value1');
    expect(memTable.getByteSize()).toBeGreaterThan(0);
    expect(memTable.size()).toBe(1);

    const flushed = memTable.flush();
    expect(flushed.length).toBe(1);
    expect(flushed[0].key).toBe('k1');
    expect(memTable.size()).toBe(0);
    expect(memTable.getByteSize()).toBe(0);
  });
});
