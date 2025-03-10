export interface TransactionContext {
  txId: string;
  readSet: Set<string>;
  writeSet: Map<string, unknown>;
  snapshotTimestamp: number;
}

export class TransactionIsolationManager {
  private activeTransactions: Map<string, TransactionContext> = new Map();
  private committedVersions: Map<string, number> = new Map();

  public beginTransaction(txId: string): TransactionContext {
    const ctx: TransactionContext = {
      txId,
      readSet: new Set(),
      writeSet: new Map(),
      snapshotTimestamp: Date.now()
    };
    this.activeTransactions.set(txId, ctx);
    return ctx;
  }

  public recordRead(txId: string, key: string): void {
    const tx = this.activeTransactions.get(txId);
    if (tx) tx.readSet.add(key);
  }

  public recordWrite(txId: string, key: string, value: unknown): void {
    const tx = this.activeTransactions.get(txId);
    if (tx) tx.writeSet.set(key, value);
  }

  public validateAndCommit(txId: string): boolean {
    const tx = this.activeTransactions.get(txId);
    if (!tx) return false;

    // Detect write-skew / dirty-write conflicts
    for (const key of tx.writeSet.keys()) {
      const lastCommitted = this.committedVersions.get(key) || 0;
      if (lastCommitted > tx.snapshotTimestamp) {
        // Conflict!
        this.activeTransactions.delete(txId);
        return false;
      }
    }

    const commitTimestamp = Date.now();
    for (const key of tx.writeSet.keys()) {
      this.committedVersions.set(key, commitTimestamp);
    }
    this.activeTransactions.delete(txId);
    return true;
  }

  public rollback(txId: string): void {
    this.activeTransactions.delete(txId);
  }
}
