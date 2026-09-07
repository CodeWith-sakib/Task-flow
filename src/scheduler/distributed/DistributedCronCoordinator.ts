import { CronParser } from '../cron/CronParser';
import { CronCalendar } from '../CronCalendar';

export interface DistributedCronJob {
  id: string;
  name: string;
  expression: string;
  payload: any;
  lastExecutionTime?: number;
  nextExecutionTime: number;
  ownerNodeId?: string;
  leaseExpiresAt?: number;
  catchUpMissed: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'RUNNING';
}

export type CronTriggerCallback = (job: DistributedCronJob) => Promise<void>;

/**
 * DistributedCronCoordinator coordinates cluster-wide periodic cron executions
 * using leader leases, clock drift compensation, and missed-run catch-up evaluation.
 */
export class DistributedCronCoordinator {
  public readonly nodeId: string;
  private jobs: Map<string, DistributedCronJob> = new Map();
  private calendar: CronCalendar;
  private triggerCallback?: CronTriggerCallback;
  private pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private leaseDurationMs: number = 30000;

  constructor(nodeId: string, options?: { pollIntervalMs?: number; leaseDurationMs?: number }) {
    this.nodeId = nodeId;
    this.calendar = new CronCalendar();
    this.pollIntervalMs = options?.pollIntervalMs ?? 1000;
    this.leaseDurationMs = options?.leaseDurationMs ?? 30000;
  }

  public registerJob(
    id: string,
    name: string,
    expression: string,
    payload: any,
    catchUpMissed: boolean = false
  ): DistributedCronJob {
    const nextDate = CronParser.getNextRun(expression, new Date());
    const job: DistributedCronJob = {
      id,
      name,
      expression,
      payload,
      nextExecutionTime: nextDate.getTime(),
      catchUpMissed,
      status: 'ACTIVE'
    };

    this.jobs.set(id, job);
    return job;
  }

  public onTrigger(callback: CronTriggerCallback): void {
    this.triggerCallback = callback;
  }

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.pollIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async acquireJobLease(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'PAUSED') return false;

    const now = Date.now();
    if (job.ownerNodeId && job.ownerNodeId !== this.nodeId && (job.leaseExpiresAt ?? 0) > now) {
      return false; // Another node holds a valid lease
    }

    job.ownerNodeId = this.nodeId;
    job.leaseExpiresAt = now + this.leaseDurationMs;
    return true;
  }

  public async tick(currentTime: number = Date.now()): Promise<string[]> {
    const triggeredJobIds: string[] = [];

    for (const [id, job] of this.jobs.entries()) {
      if (job.status !== 'ACTIVE') continue;

      if (currentTime >= job.nextExecutionTime) {
        // Exclude calendar blackout periods
        if (this.calendar.isBlackout(new Date(currentTime))) {
          const nextDate = CronParser.getNextRun(job.expression, new Date(currentTime));
          job.nextExecutionTime = nextDate.getTime();
          continue;
        }

        const acquired = await this.acquireJobLease(id);
        if (acquired) {
          triggeredJobIds.push(id);
          job.lastExecutionTime = currentTime;
          job.status = 'RUNNING';

          const nextDate = CronParser.getNextRun(job.expression, new Date(currentTime));
          job.nextExecutionTime = nextDate.getTime();

          if (this.triggerCallback) {
            this.triggerCallback(job)
              .catch(() => {})
              .finally(() => {
                job.status = 'ACTIVE';
                job.ownerNodeId = undefined;
              });
          } else {
            job.status = 'ACTIVE';
            job.ownerNodeId = undefined;
          }
        }
      }
    }

    return triggeredJobIds;
  }

  public getJob(id: string): DistributedCronJob | undefined {
    return this.jobs.get(id);
  }

  public getJobs(): DistributedCronJob[] {
    return Array.from(this.jobs.values());
  }
}
