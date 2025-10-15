import { CronScheduler } from '../../src/scheduler/CronScheduler';
import { TaskService } from '../../src/core/TaskService';
import { InMemoryDB } from '../../src/storage/db/InMemoryDB';
import { RedisQueueAbstraction } from '../../src/queue/redis/RedisQueueAbstraction';
import { EventEmitter } from '../../src/events/EventEmitter';
import { StateTransitioner } from '../../src/core/state/StateTransitioner';
import { RetryManager } from '../../src/core/retry/RetryManager';
import { TaskScheduler } from '../../src/core/scheduler/TaskScheduler';
import { TaskHandlerRegistry } from '../../src/core/lifecycle/TaskHandlerRegistry';

describe('CronScheduler', () => {
  let scheduler: CronScheduler;
  let db: InMemoryDB;
  let taskService: TaskService;

  beforeEach(() => {
    db = new InMemoryDB();
    const queue = new RedisQueueAbstraction();
    const emitter = new EventEmitter();
    const stateTransitioner = new StateTransitioner();
    const retryManager = new RetryManager();
    const taskScheduler = new TaskScheduler();
    const registry = new TaskHandlerRegistry();

    taskService = new TaskService(
      db,
      queue,
      emitter,
      stateTransitioner,
      retryManager,
      taskScheduler,
      registry
    );

    scheduler = new CronScheduler(taskService, 60000);
  });

  it('should register a valid cron job and compute next run', () => {
    const job = scheduler.registerJob({
      id: 'hourly_cleanup',
      cronExpression: '0 * * * *',
      taskType: 'cleanup',
      priority: 5,
    });

    expect(job.status).toBe('ACTIVE');
    expect(job.nextRunAt).toBeDefined();
    expect(scheduler.getJob('hourly_cleanup')).not.toBeNull();
  });

  it('should trigger job on tick when nextRunAt is reached', async () => {
    const job = scheduler.registerJob({
      id: 'periodic_sync',
      cronExpression: '*/10 * * * *',
      taskType: 'sync_data',
    });

    // Advance time to exactly when job should run
    const runTime = new Date(job.nextRunAt.getTime() + 1000);
    const triggered = await scheduler.tick(runTime);

    expect(triggered.length).toBe(1);
    const tasks = await db.getAllTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].type).toBe('sync_data');

    // Job totalRuns incremented and nextRunAt recalculated
    const updatedJob = scheduler.getJob('periodic_sync');
    expect(updatedJob?.totalRuns).toBe(1);
    expect(updatedJob?.lastRunAt).toBeDefined();
    expect(updatedJob!.nextRunAt.getTime()).toBeGreaterThan(runTime.getTime());
  });

  it('should respect pause and resume status', async () => {
    const job = scheduler.registerJob({
      id: 'pause_test',
      cronExpression: '* * * * *',
      taskType: 'test',
    });

    scheduler.pauseJob('pause_test');
    expect(scheduler.getJob('pause_test')?.status).toBe('PAUSED');

    const triggered = await scheduler.tick(new Date(job.nextRunAt.getTime() + 1000));
    expect(triggered.length).toBe(0);

    scheduler.resumeJob('pause_test');
    expect(scheduler.getJob('pause_test')?.status).toBe('ACTIVE');
  });
});
