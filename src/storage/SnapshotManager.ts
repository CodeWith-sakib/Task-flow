export interface StateSnapshot<T> {
  id: string;
  timestamp: number;
  data: Record<string, T>;
  metadata?: Record<string, unknown>;
}

export class SnapshotManager<T> {
  private snapshots: Map<string, StateSnapshot<T>> = new Map();

  public createSnapshot(id: string, currentState: Record<string, T>, metadata?: Record<string, unknown>): StateSnapshot<T> {
    const snapshot: StateSnapshot<T> = {
      id,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(currentState)),
      metadata
    };
    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  public getSnapshot(id: string): StateSnapshot<T> | undefined {
    return this.snapshots.get(id);
  }

  public restoreSnapshot(id: string): Record<string, T> | undefined {
    const snap = this.snapshots.get(id);
    if (!snap) return undefined;
    return JSON.parse(JSON.stringify(snap.data));
  }

  public listSnapshots(): StateSnapshot<T>[] {
    return Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  public deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }
}
