/**
 * Multi-Version Concurrency Control (MVCC) Storage Engine.
 * Provides Snapshot Isolation, non-blocking reads, write-conflict detection,
 * transaction commit timestamps, and background garbage collection / vacuuming.
 */

export interface VersionRecord<T> {
  txId: number;
  commitTs: number;
  deleted: boolean;
  data?: T;
  prev?: VersionRecord<T>;
}

export interface TransactionContext {
  txId: number;
  readTs: number;
  writeSet: Map<string, any>;
  deletedSet: Set<string>;
  state: 'ACTIVE' | 'COMMITTED' | 'ABORTED';
}

export class MVCCStorageEngine<T = any> {
  private versions = new Map<string, VersionRecord<T>>();
  private activeTransactions = new Map<number, TransactionContext>();
  private nextTxId = 1;
  private currentTs = 100;
  private minActiveReadTs = Infinity;

  public beginTransaction(): TransactionContext {
    const txId = this.nextTxId++;
    const readTs = this.currentTs;

    const tx: TransactionContext = {
      txId,
      readTs,
      writeSet: new Map(),
      deletedSet: new Set(),
      state: 'ACTIVE',
    };

    this.activeTransactions.set(txId, tx);
    this.updateMinActiveReadTs();
    return tx;
  }

  public get(key: string, tx: TransactionContext): T | undefined {
    this.assertActive(tx);

    // Read uncommitted changes from local writeSet
    if (tx.deletedSet.has(key)) {
      return undefined;
    }
    if (tx.writeSet.has(key)) {
      return tx.writeSet.get(key);
    }

    // Traverse version chain to find latest version visible to tx.readTs
    let curr = this.versions.get(key);
    while (curr) {
      if (curr.commitTs <= tx.readTs) {
        if (curr.deleted) {
          return undefined;
        }
        return curr.data;
      }
      curr = curr.prev;
    }

    return undefined;
  }

  public put(key: string, value: T, tx: TransactionContext): void {
    this.assertActive(tx);
    tx.deletedSet.delete(key);
    tx.writeSet.set(key, value);
  }

  public delete(key: string, tx: TransactionContext): void {
    this.assertActive(tx);
    tx.writeSet.delete(key);
    tx.deletedSet.add(key);
  }

  public commit(tx: TransactionContext): void {
    this.assertActive(tx);

    // First-Committer-Wins write conflict detection
    const commitTs = ++this.currentTs;

    for (const key of [...tx.writeSet.keys(), ...tx.deletedSet]) {
      const latestVersion = this.versions.get(key);
      if (latestVersion && latestVersion.commitTs > tx.readTs) {
        tx.state = 'ABORTED';
        this.activeTransactions.delete(tx.txId);
        this.updateMinActiveReadTs();
        throw new Error(`Write conflict detected on key "${key}". Transaction aborted.`);
      }
    }

    // Apply writes
    for (const [key, value] of tx.writeSet.entries()) {
      const prev = this.versions.get(key);
      const newVersion: VersionRecord<T> = {
        txId: tx.txId,
        commitTs,
        deleted: false,
        data: value,
        prev,
      };
      this.versions.set(key, newVersion);
    }

    // Apply deletes
    for (const key of tx.deletedSet) {
      const prev = this.versions.get(key);
      const newVersion: VersionRecord<T> = {
        txId: tx.txId,
        commitTs,
        deleted: true,
        prev,
      };
      this.versions.set(key, newVersion);
    }

    tx.state = 'COMMITTED';
    this.activeTransactions.delete(tx.txId);
    this.updateMinActiveReadTs();
  }

  public abort(tx: TransactionContext): void {
    if (tx.state === 'ACTIVE') {
      tx.state = 'ABORTED';
      tx.writeSet.clear();
      tx.deletedSet.clear();
      this.activeTransactions.delete(tx.txId);
      this.updateMinActiveReadTs();
    }
  }

  /**
   * Vacuum old unreachable version chains older than minActiveReadTs.
   */
  public vacuum(): { purgedVersions: number } {
    let purgedVersions = 0;
    const watermark = this.activeTransactions.size > 0 ? this.minActiveReadTs : this.currentTs;

    for (const [key, root] of this.versions.entries()) {
      let curr: VersionRecord<T> | undefined = root;
      let lastVisible: VersionRecord<T> | undefined = undefined;

      while (curr) {
        if (curr.commitTs <= watermark) {
          if (!lastVisible) {
            lastVisible = curr;
          } else {
            // Cut version chain after first fully visible commit below watermark
            lastVisible.prev = undefined;
            purgedVersions++;
          }
        }
        curr = curr.prev;
      }

      // If root is tombstone and older than watermark, remove entirely
      if (root.deleted && root.commitTs <= watermark && !root.prev) {
        this.versions.delete(key);
      }
    }

    return { purgedVersions };
  }

  private assertActive(tx: TransactionContext): void {
    if (tx.state !== 'ACTIVE') {
      throw new Error(`Transaction ${tx.txId} is not ACTIVE (current state: ${tx.state})`);
    }
  }

  private updateMinActiveReadTs(): void {
    if (this.activeTransactions.size === 0) {
      this.minActiveReadTs = Infinity;
      return;
    }

    let min = Infinity;
    for (const tx of this.activeTransactions.values()) {
      if (tx.readTs < min) {
        min = tx.readTs;
      }
    }
    this.minActiveReadTs = min;
  }
}
