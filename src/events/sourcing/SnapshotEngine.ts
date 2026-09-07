export interface AggregateSnapshot {
  aggregateId: string;
  version: number;
  state: any;
  timestamp: number;
}

/**
 * SnapshotEngine maintains periodic state snapshots for aggregates to accelerate event-sourced hydration.
 */
export class SnapshotEngine {
  private snapshots: Map<string, AggregateSnapshot> = new Map();
  private snapshotFrequency: number;

  constructor(snapshotFrequency: number = 100) {
    this.snapshotFrequency = snapshotFrequency;
  }

  public shouldTakeSnapshot(currentVersion: number, lastSnapshotVersion: number = 0): boolean {
    return (currentVersion - lastSnapshotVersion) >= this.snapshotFrequency;
  }

  public saveSnapshot(aggregateId: string, version: number, state: any): AggregateSnapshot {
    const snapshot: AggregateSnapshot = {
      aggregateId,
      version,
      state: JSON.parse(JSON.stringify(state)),
      timestamp: Date.now()
    };

    this.snapshots.set(aggregateId, snapshot);
    return snapshot;
  }

  public getSnapshot(aggregateId: string): AggregateSnapshot | null {
    const snapshot = this.snapshots.get(aggregateId);
    return snapshot ? { ...snapshot, state: JSON.parse(JSON.stringify(snapshot.state)) } : null;
  }

  public deleteSnapshot(aggregateId: string): boolean {
    return this.snapshots.delete(aggregateId);
  }

  public clear(): void {
    this.snapshots.clear();
  }
}
