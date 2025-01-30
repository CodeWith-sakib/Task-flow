import { TombstoneCompactor } from '../../src/storage/TombstoneCompactor';

describe('TombstoneCompactor', () => {
  it('should purge tombstones older than retention window', () => {
    const compactor = new TombstoneCompactor(5000);
    const now = 10000;
    const records = [
      { key: 'live-1', isTombstone: false, timestamp: 8000 },
      { key: 'dead-recent', isTombstone: true, timestamp: 6000 },
      { key: 'dead-old', isTombstone: true, timestamp: 2000 }
    ];

    const result = compactor.compact(records, now);
    expect(result.purgedCount).toBe(1);
    expect(result.retained.map(r => r.key)).toEqual(['live-1', 'dead-recent']);
  });
});
