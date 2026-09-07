import { LogEntry, LogIndex, Term } from './types';
import { computeCRC32 as crc32 } from '../storage/wal/crc32';

/**
 * RaftLog manages append-only replicated log entries with CRC32 integrity checks,
 * logarithmic search, fast slice extraction, conflict truncation, and snapshot compaction.
 */
export class RaftLog<T = any> {
  private entries: LogEntry<T>[] = [];
  private lastSnapshotIndex: LogIndex = 0;
  private lastSnapshotTerm: Term = 0;
  private commitIndex: LogIndex = 0;
  private lastApplied: LogIndex = 0;

  constructor(initialSnapshotIndex: LogIndex = 0, initialSnapshotTerm: Term = 0) {
    this.lastSnapshotIndex = initialSnapshotIndex;
    this.lastSnapshotTerm = initialSnapshotTerm;
    this.commitIndex = initialSnapshotIndex;
    this.lastApplied = initialSnapshotIndex;
  }

  public append(term: Term, command: T): LogEntry<T> {
    const nextIndex = this.getLastLogIndex() + 1;
    const timestamp = Date.now();
    const payloadStr = JSON.stringify({ index: nextIndex, term, command, timestamp });
    const checksum = crc32(payloadStr);

    const entry: LogEntry<T> = {
      index: nextIndex,
      term,
      command,
      timestamp,
      checksum
    };

    this.entries.push(entry);
    return entry;
  }

  public appendEntries(prevLogIndex: LogIndex, prevLogTerm: Term, newEntries: LogEntry<T>[]): boolean {
    if (prevLogIndex > 0) {
      const termAtPrev = this.getTermForIndex(prevLogIndex);
      if (termAtPrev === null || termAtPrev !== prevLogTerm) {
        return false;
      }
    }

    let insertIdx = 0;
    while (insertIdx < newEntries.length) {
      const entry = newEntries[insertIdx];
      const existingTerm = this.getTermForIndex(entry.index);

      if (existingTerm !== null) {
        if (existingTerm !== entry.term) {
          this.truncateFrom(entry.index);
          break;
        }
        insertIdx++;
      } else {
        break;
      }
    }

    for (let i = insertIdx; i < newEntries.length; i++) {
      const entry = newEntries[i];
      if (entry.index <= this.getLastLogIndex()) {
        this.truncateFrom(entry.index);
      }
      this.entries.push(entry);
    }

    return true;
  }

  public getEntry(index: LogIndex): LogEntry<T> | null {
    if (index <= this.lastSnapshotIndex) {
      return null;
    }
    const arrayIndex = this.toArrayIndex(index);
    if (arrayIndex < 0 || arrayIndex >= this.entries.length) {
      return null;
    }
    return this.entries[arrayIndex];
  }

  public getEntriesFrom(startIndex: LogIndex, maxCount?: number): LogEntry<T>[] {
    if (startIndex > this.getLastLogIndex()) {
      return [];
    }
    const effectiveStart = Math.max(startIndex, this.lastSnapshotIndex + 1);
    const startArrayIdx = this.toArrayIndex(effectiveStart);
    if (startArrayIdx < 0 || startArrayIdx >= this.entries.length) {
      return [];
    }

    const endArrayIdx = maxCount ? Math.min(this.entries.length, startArrayIdx + maxCount) : this.entries.length;
    return this.entries.slice(startArrayIdx, endArrayIdx);
  }

  public getTermForIndex(index: LogIndex): Term | null {
    if (index === 0) return 0;
    if (index === this.lastSnapshotIndex) {
      return this.lastSnapshotTerm;
    }
    if (index < this.lastSnapshotIndex) {
      return null;
    }
    const entry = this.getEntry(index);
    return entry ? entry.term : null;
  }

  public getLastLogIndex(): LogIndex {
    if (this.entries.length === 0) {
      return this.lastSnapshotIndex;
    }
    return this.entries[this.entries.length - 1].index;
  }

  public getLastLogTerm(): Term {
    if (this.entries.length === 0) {
      return this.lastSnapshotTerm;
    }
    return this.entries[this.entries.length - 1].term;
  }

  public truncateFrom(startIndex: LogIndex): void {
    if (startIndex <= this.lastSnapshotIndex) {
      throw new Error(`Cannot truncate entries before snapshot index ${this.lastSnapshotIndex}`);
    }
    const arrayIndex = this.toArrayIndex(startIndex);
    if (arrayIndex >= 0 && arrayIndex < this.entries.length) {
      this.entries.splice(arrayIndex);
    }
  }

  public compact(snapshotIndex: LogIndex, snapshotTerm: Term): void {
    if (snapshotIndex <= this.lastSnapshotIndex) {
      return;
    }
    if (snapshotIndex > this.getLastLogIndex()) {
      this.entries = [];
    } else {
      const arrayIndex = this.toArrayIndex(snapshotIndex);
      if (arrayIndex >= 0) {
        this.entries.splice(0, arrayIndex + 1);
      }
    }
    this.lastSnapshotIndex = snapshotIndex;
    this.lastSnapshotTerm = snapshotTerm;
    if (this.commitIndex < snapshotIndex) {
      this.commitIndex = snapshotIndex;
    }
    if (this.lastApplied < snapshotIndex) {
      this.lastApplied = snapshotIndex;
    }
  }

  public setCommitIndex(index: LogIndex): void {
    this.commitIndex = Math.min(Math.max(this.commitIndex, index), this.getLastLogIndex());
  }

  public getCommitIndex(): LogIndex {
    return this.commitIndex;
  }

  public setLastApplied(index: LogIndex): void {
    this.lastApplied = Math.min(Math.max(this.lastApplied, index), this.commitIndex);
  }

  public getLastApplied(): LogIndex {
    return this.lastApplied;
  }

  public getSnapshotMetadata(): { lastIndex: LogIndex; lastTerm: Term } {
    return {
      lastIndex: this.lastSnapshotIndex,
      lastTerm: this.lastSnapshotTerm
    };
  }

  public getUnappliedEntries(): LogEntry<T>[] {
    if (this.lastApplied >= this.commitIndex) {
      return [];
    }
    return this.getEntriesFrom(this.lastApplied + 1, this.commitIndex - this.lastApplied);
  }

  public verifyIntegrity(): boolean {
    for (const entry of this.entries) {
      if (entry.checksum !== undefined) {
        const payloadStr = JSON.stringify({
          index: entry.index,
          term: entry.term,
          command: entry.command,
          timestamp: entry.timestamp
        });
        if (crc32(payloadStr) !== entry.checksum) {
          return false;
        }
      }
    }
    return true;
  }

  private toArrayIndex(index: LogIndex): number {
    return index - (this.lastSnapshotIndex + 1);
  }
}
