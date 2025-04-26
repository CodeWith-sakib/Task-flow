export interface JournalEntry {
  opId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  timestamp: number;
}

export class RecoveryJournal {
  private entries: JournalEntry[] = [];

  public append(opId: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: Record<string, unknown>): void {
    this.entries.push({
      opId,
      action,
      payload,
      timestamp: Date.now()
    });
  }

  public getUncheckpointedEntries(sinceTimestamp: number): JournalEntry[] {
    return this.entries.filter(e => e.timestamp >= sinceTimestamp);
  }

  public truncateBefore(timestamp: number): number {
    const initialLen = this.entries.length;
    this.entries = this.entries.filter(e => e.timestamp >= timestamp);
    return initialLen - this.entries.length;
  }

  public size(): number {
    return this.entries.length;
  }
}
