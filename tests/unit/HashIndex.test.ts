import { HashIndex } from '../../src/storage/HashIndex';

describe('HashIndex', () => {
  it('should store and retrieve values with collision handling', () => {
    const index = new HashIndex<string>(4);
    index.set('key1', 'val1');
    index.set('key2', 'val2');
    index.set('key3', 'val3');

    expect(index.get('key1')).toBe('val1');
    expect(index.get('key2')).toBe('val2');
    expect(index.delete('key1')).toBe(true);
    expect(index.get('key1')).toBeUndefined();
  });
});
