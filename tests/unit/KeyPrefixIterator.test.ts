import { KeyPrefixIterator } from '../../src/storage/KeyPrefixIterator';

describe('KeyPrefixIterator', () => {
  it('should find all keys matching given prefix', () => {
    const map = new Map<string, string>([
      ['tenant:1:task:a', 'valA'],
      ['tenant:1:task:b', 'valB'],
      ['tenant:2:task:c', 'valC']
    ]);
    const iter = new KeyPrefixIterator(map);

    const res = iter.iteratePrefix('tenant:1:');
    expect(res.length).toBe(2);
    expect(res[0].key).toBe('tenant:1:task:a');
    expect(res[1].key).toBe('tenant:1:task:b');
  });

  it('should delete keys by prefix', () => {
    const map = new Map<string, string>([
      ['org:1:a', '1'],
      ['org:1:b', '2'],
      ['org:2:a', '3']
    ]);
    const iter = new KeyPrefixIterator(map);
    expect(iter.deletePrefix('org:1:')).toBe(2);
    expect(map.size).toBe(1);
    expect(map.has('org:2:a')).toBe(true);
  });
});
