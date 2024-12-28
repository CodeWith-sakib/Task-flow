import { SnowflakeIdGenerator } from '../../src/utils/id/SnowflakeIdGenerator';

describe('SnowflakeIdGenerator Unit Tests', () => {
  it('should generate monotonically increasing unique 64-bit string IDs', () => {
    const gen = new SnowflakeIdGenerator(1);
    const id1 = gen.nextId();
    const id2 = gen.nextId();
    expect(id1).not.toBe(id2);
    expect(BigInt(id2)).toBeGreaterThan(BigInt(id1));
  });
});
