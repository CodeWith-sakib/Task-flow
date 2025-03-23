import { WriteBatchBuffer } from '../../src/storage/WriteBatchBuffer';

describe('WriteBatchBuffer', () => {
  it('should buffer put and delete operations and drain them', () => {
    const batch = new WriteBatchBuffer<string>(3);
    expect(batch.put('k1', 'v1')).toBe(false);
    expect(batch.delete('k2')).toBe(false);
    expect(batch.put('k3', 'v3')).toBe(true);

    expect(batch.size()).toBe(3);
    const ops = batch.drain();
    expect(ops.length).toBe(3);
    expect(batch.size()).toBe(0);
  });
});
