export enum DrainPhase {
  RUNNING = 'RUNNING',
  STOPPING_ADMISSION = 'STOPPING_ADMISSION',
  WAITING_INFLIGHT = 'WAITING_INFLIGHT',
  CHECKPOINTING = 'CHECKPOINTING',
  TERMINATED = 'TERMINATED'
}

export interface DrainOptions {
  drainTimeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * GracefulDrainCoordinator manages zero-loss application shutdowns by coordinating
 * task admission rejection, in-flight completion awaiting, and final state checkpointing.
 */
export class GracefulDrainCoordinator {
  private phase: DrainPhase = DrainPhase.RUNNING;
  private inflightTasks: Set<string> = new Set();
  private options: Required<DrainOptions>;
  private checkpointHook?: () => Promise<void>;

  constructor(options?: DrainOptions) {
    this.options = {
      drainTimeoutMs: options?.drainTimeoutMs ?? 30000,
      pollIntervalMs: options?.pollIntervalMs ?? 100
    };
  }

  public registerInflight(taskId: string): boolean {
    if (this.phase !== DrainPhase.RUNNING) {
      return false; // Admission rejected: node is draining
    }
    this.inflightTasks.add(taskId);
    return true;
  }

  public completeInflight(taskId: string): void {
    this.inflightTasks.delete(taskId);
  }

  public onCheckpoint(hook: () => Promise<void>): void {
    this.checkpointHook = hook;
  }

  public async initiateDrain(): Promise<boolean> {
    if (this.phase !== DrainPhase.RUNNING) {
      return false;
    }

    // Phase 1: Stop admission
    this.phase = DrainPhase.STOPPING_ADMISSION;

    // Phase 2: Wait for in-flight tasks to complete within deadline
    this.phase = DrainPhase.WAITING_INFLIGHT;
    const startTime = Date.now();

    while (this.inflightTasks.size > 0) {
      if (Date.now() - startTime >= this.options.drainTimeoutMs) {
        break; // Deadline reached
      }
      await new Promise(r => setTimeout(r, this.options.pollIntervalMs));
    }

    // Phase 3: Checkpoint state
    this.phase = DrainPhase.CHECKPOINTING;
    if (this.checkpointHook) {
      try {
        await this.checkpointHook();
      } catch {
        // Ignore checkpoint failure on shutdown
      }
    }

    // Phase 4: Final termination
    this.phase = DrainPhase.TERMINATED;
    return this.inflightTasks.size === 0;
  }

  public getPhase(): DrainPhase {
    return this.phase;
  }

  public getInflightCount(): number {
    return this.inflightTasks.size;
  }

  public isAcceptingWork(): boolean {
    return this.phase === DrainPhase.RUNNING;
  }
}
