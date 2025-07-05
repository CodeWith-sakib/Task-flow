export class MessageDeduplicator {
  private seen: Map<string, number> = new Map();
  private windowMs: number;

  constructor(windowMs: number = 60000) {
    this.windowMs = windowMs;
  }

  public isDuplicate(dedupKey: string, now: number = Date.now()): boolean {
    const lastSeen = this.seen.get(dedupKey);
    if (lastSeen && (now - lastSeen) < this.windowMs) {
      return true;
    }
    this.seen.set(dedupKey, now);
    return false;
  }

  public prune(now: number = Date.now()): number {
    let pruned = 0;
    for (const [key, timestamp] of Array.from(this.seen.entries())) {
      if (now - timestamp >= this.windowMs) {
        this.seen.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}
