/**
 * K-Way SSTable Merge Iterator.
 * Merges multiple sorted runs / iterators into a single consolidated stream,
 * resolving duplicate keys by picking the latest timestamp/version and filtering tombstones.
 */

export interface KeyValueEntry {
  key: string;
  value: Buffer | string | null; // null represents tombstone
  version: number;
  timestamp: number;
}

export interface SortedRunIterator {
  hasNext(): boolean;
  peek(): KeyValueEntry | null;
  next(): KeyValueEntry | null;
}

export class SSTableMergeIterator {
  private iterators: SortedRunIterator[];

  constructor(iterators: SortedRunIterator[]) {
    this.iterators = iterators.filter((it) => it.hasNext());
  }

  public hasNext(): boolean {
    return this.iterators.some((it) => it.hasNext());
  }

  /**
   * Advances and returns the next deduplicated, latest-version entry across all runs.
   */
  public next(filterTombstones: boolean = false): KeyValueEntry | null {
    while (this.hasNext()) {
      // 1. Find the smallest key across all iterator heads
      let smallestKey: string | null = null;

      for (const it of this.iterators) {
        if (!it.hasNext()) continue;
        const entry = it.peek();
        if (!entry) continue;

        if (smallestKey === null || entry.key < smallestKey) {
          smallestKey = entry.key;
        }
      }

      if (smallestKey === null) return null;

      // 2. Collect all entries matching smallestKey and pick highest version/timestamp
      let winner: KeyValueEntry | null = null;

      for (const it of this.iterators) {
        if (!it.hasNext()) continue;
        const entry = it.peek();
        if (entry && entry.key === smallestKey) {
          const popped = it.next()!;
          if (!winner || popped.version > winner.version || (popped.version === winner.version && popped.timestamp > winner.timestamp)) {
            winner = popped;
          }
        }
      }

      // 3. If filterTombstones is enabled and winner is a tombstone (null value), skip it
      if (winner && filterTombstones && winner.value === null) {
        continue;
      }

      return winner;
    }

    return null;
  }
}
