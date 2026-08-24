import { MurmurHash3 } from '../../src/utils/MurmurHash3';

describe('MurmurHash3', () => {
  it('should compute deterministic 32-bit integer hashes', () => {
    const h1 = MurmurHash3.hash32('taskflow');
    const h2 = MurmurHash3.hash32('taskflow');
    expect(h1).toBe(h2);
    expect(typeof h1).toBe('number');
  });
});
