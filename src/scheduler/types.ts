export type MisfirePolicy = 'FIRE_NOW' | 'IGNORE' | 'RESCHEDULE_NEXT';

export interface CronJobDefinition {
  id: string;
  cronExpression: string;
  taskType: string;
  payload?: Record<string, any>;
  timezone?: string;
  misfirePolicy?: MisfirePolicy;
  priority?: number;
  maxRetries?: number;
}

export interface ScheduledCronJob extends CronJobDefinition {
  status: 'ACTIVE' | 'PAUSED';
  lastRunAt?: Date;
  nextRunAt: Date;
  totalRuns: number;
  createdAt: Date;
  updatedAt: Date;
}
