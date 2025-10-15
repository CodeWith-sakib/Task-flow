import { TaskService } from '../core/TaskService';
import { CronJobDefinition, ScheduledCronJob, MisfirePolicy } from './types';
import { CronParser } from './cron/CronParser';

export class CronScheduler {
  private jobs: Map<string, ScheduledCronJob> = new Map();
  private misfireThresholdMs: number;

  constructor(
    private taskService: TaskService,
    misfireThresholdMs: number = 60000 // 1 minute
  ) {
    this.misfireThresholdMs = misfireThresholdMs;
  }

  registerJob(def: CronJobDefinition): ScheduledCronJob {
    if (!CronParser.validate(def.cronExpression)) {
      throw new Error(`Invalid cron expression: '${def.cronExpression}'`);
    }

    const nextRun = CronParser.getNextRun(def.cronExpression);
    const job: ScheduledCronJob = {
      ...def,
      status: 'ACTIVE',
      nextRunAt: nextRun,
      totalRuns: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      misfirePolicy: def.misfirePolicy || 'FIRE_NOW',
    };

    this.jobs.set(job.id, job);
    return job;
  }

  pauseJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.status = 'PAUSED';
    job.updatedAt = new Date();
    return true;
  }

  resumeJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.status = 'ACTIVE';
    job.nextRunAt = CronParser.getNextRun(job.cronExpression);
    job.updatedAt = new Date();
    return true;
  }

  removeJob(id: string): boolean {
    return this.jobs.delete(id);
  }

  getJob(id: string): ScheduledCronJob | null {
    return this.jobs.get(id) ?? null;
  }

  listJobs(): ScheduledCronJob[] {
    return Array.from(this.jobs.values());
  }

  async tick(currentTime: Date = new Date()): Promise<string[]> {
    const triggeredTaskIds: string[] = [];
    const nowTime = currentTime.getTime();

    for (const job of this.jobs.values()) {
      if (job.status !== 'ACTIVE') continue;

      if (job.nextRunAt.getTime() <= nowTime) {
        const diff = nowTime - job.nextRunAt.getTime();
        const isMisfired = diff > this.misfireThresholdMs;

        let shouldFire = true;
        if (isMisfired) {
          if (job.misfirePolicy === 'IGNORE') {
            shouldFire = false;
          } else if (job.misfirePolicy === 'RESCHEDULE_NEXT') {
            shouldFire = false;
          }
          // Default 'FIRE_NOW' proceeds to fire
        }

        if (shouldFire) {
          const task = await this.taskService.createTask({
            type: job.taskType,
            payload: {
              ...(job.payload || {}),
              __cron: {
                jobId: job.id,
                scheduledFor: job.nextRunAt.toISOString(),
                executedAt: currentTime.toISOString(),
              },
            },
            priority: job.priority ?? 0,
            maxRetries: job.maxRetries ?? 3,
          });

          triggeredTaskIds.push(task.id);
          job.lastRunAt = new Date(currentTime);
          job.totalRuns++;
        }

        // Advance to next schedule
        job.nextRunAt = CronParser.getNextRun(job.cronExpression, currentTime);
        job.updatedAt = new Date(currentTime);
      }
    }

    return triggeredTaskIds;
  }
}
