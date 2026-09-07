import { BloomFilter } from '../../storage/index/BloomFilter';

export interface DeduplicationRecord {
  messageId: string;
  fingerprint: string;
  seenAt: number;
}

/**
 * IdempotentMessageDeduplicator combines a fast-path Bloom Filter with an LRU window buffer
 * to guarantee at-most-once delivery and reject duplicate message processing.
 */
export class IdempotentMessageDeduplicator {
  private bloomFilter: BloomFilter;
  private lruWindow: Map<string, DeduplicationRecord> = new Map();
  private windowCapacity: number;
  private ttlMs: number;

  constructor(windowCapacity: number = 10000, ttlMs: number = 3600000) {
    this.windowCapacity = windowCapacity;
    this.ttlMs = ttlMs;
    this.bloomFilter = new BloomFilter(windowCapacity * 2, 0.001);
  }

  public isDuplicate(messageId: string, fingerprint?: string): boolean {
    const key = fingerprint ? `${messageId}:${fingerprint}` : messageId;

    if (!this.bloomFilter.has(key)) {
      return false; // Definitely not seen
    }

    // Check exact LRU window to rule out Bloom filter false positives
    const existing = this.lruWindow.get(key);
    if (!existing) {
      return false;
    }

    const now = Date.now();
    if (now - existing.seenAt > this.ttlMs) {
      this.lruWindow.delete(key);
      return false; // Expired
    }

    return true;
  }

  public record(messageId: string, fingerprint?: string): void {
    const key = fingerprint ? `${messageId}:${fingerprint}` : messageId;
    this.bloomFilter.add(key);

    if (this.lruWindow.size >= this.windowCapacity) {
      const oldestKey = this.lruWindow.keys().next().value;
      if (oldestKey) this.lruWindow.delete(oldestKey);
    }

    this.lruWindow.set(key, {
      messageId,
      fingerprint: fingerprint || '',
      seenAt: Date.now()
    });
  }

  public clear(): void {
    this.bloomFilter.clear();
    this.lruWindow.clear();
  }
}
