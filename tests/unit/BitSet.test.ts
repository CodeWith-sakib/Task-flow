import { BitSet } from '../../src/utils/BitSet';

describe('BitSet', () => {
  it('should set, get, and clear bits efficiently', () => {
    const bitset = new BitSet(100);
    expect(bitset.get(42)).toBe(false);

    bitset.set(42);
    expect(bitset.get(42)).toBe(true);

    bitset.clear(42);
    expect(bitset.get(42)).toBe(false);
  });
});
