import { MessageDeduplicator } from '../../src/queue/MessageDeduplicator';

describe('MessageDeduplicator', () => {
  it('should detect duplicate keys within time window', () => {
    const dedup = new MessageDeduplicator(1000);
    const now = 5000;

    expect(dedup.isDuplicate('msg-1', now)).toBe(false);
    expect(dedup.isDuplicate('msg-1', now + 200)).toBe(true);
    expect(dedup.isDuplicate('msg-1', now + 1200)).toBe(false);
  });
});
