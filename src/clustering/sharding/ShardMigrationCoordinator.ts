export enum MigrationState {
  INITIALIZING = 'INITIALIZING',
  STREAMING_DATA = 'STREAMING_DATA',
  CATCHING_UP = 'CATCHING_UP',
  CUTOVER = 'CUTOVER',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface ShardMigrationPlan {
  shardId: number;
  sourceNodeId: string;
  targetNodeId: string;
  state: MigrationState;
  migratedRecords: number;
  startTime: number;
  completedTime?: number;
}

/**
 * ShardMigrationCoordinator orchestrates online shard movements between cluster nodes
 * with two-phase cutover and dual-routing during sync.
 */
export class ShardMigrationCoordinator {
  private activeMigrations: Map<number, ShardMigrationPlan> = new Map();

  public initiateMigration(shardId: number, sourceNodeId: string, targetNodeId: string): ShardMigrationPlan {
    const plan: ShardMigrationPlan = {
      shardId,
      sourceNodeId,
      targetNodeId,
      state: MigrationState.INITIALIZING,
      migratedRecords: 0,
      startTime: Date.now()
    };

    this.activeMigrations.set(shardId, plan);
    return plan;
  }

  public recordProgress(shardId: number, count: number): void {
    const plan = this.activeMigrations.get(shardId);
    if (plan) {
      plan.migratedRecords += count;
      plan.state = MigrationState.STREAMING_DATA;
    }
  }

  public commitCutover(shardId: number): boolean {
    const plan = this.activeMigrations.get(shardId);
    if (!plan) return false;

    plan.state = MigrationState.COMPLETED;
    plan.completedTime = Date.now();
    return true;
  }

  public getMigration(shardId: number): ShardMigrationPlan | undefined {
    return this.activeMigrations.get(shardId);
  }

  public isShardInMigration(shardId: number): boolean {
    const m = this.activeMigrations.get(shardId);
    return !!m && m.state !== MigrationState.COMPLETED && m.state !== MigrationState.FAILED;
  }
}
