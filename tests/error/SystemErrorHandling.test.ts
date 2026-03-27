import { TaskService } from '../../src/core/TaskService';
import { InMemoryDB } from '../../src/storage/db/InMemoryDB';
import { RedisQueueAbstraction } from '../../src/queue/redis/RedisQueueAbstraction';
import { StateTransitioner } from '../../src/core/state/StateTransitioner';
import { EventEmitter, TaskEvent } from '../../src/events/EventEmitter';
import { RetryManager } from '../../src/core/retry/RetryManager';
import { TaskScheduler } from '../../src/core/scheduler/TaskScheduler';
import { TaskHandlerRegistry } from '../../src/core/lifecycle/TaskHandlerRegistry';
import { Worker } from '../../src/workers/Worker';
import { TaskStatus } from '../../src/types';

describe('System Error Handling & Fault Resilience', () => {
  let taskService: TaskService;
  let db: InMemoryDB;
  let queue: RedisQueueAbstraction;
  let registry: TaskHandlerRegistry;

  beforeEach(() => {
    db = new InMemoryDB();
    queue = new RedisQueueAbstraction();
    const emitter = new EventEmitter();
    const stateTransitioner = new StateTransitioner();
    const retryManager = new RetryManager();
    const scheduler = new TaskScheduler();
    registry = new TaskHandlerRegistry();

    taskService = new TaskService(
      db,
      queue,
      emitter,
      stateTransitioner,
      retryManager,
      scheduler,
      registry
    );
  });

  it('should safely capture asynchronous rejection inside task handlers', async () => {
    registry.register('failing_task', async () => {
      throw new Error('Database connection reset during query');
    });

    const task = await taskService.createTask({
      type: 'failing_task',
      payload: {},
      maxRetries: 0,
    });

    const worker = new Worker(
      taskService,
      queue,
      db,
      new EventEmitter(),
      new TaskScheduler(),
      registry,
      1,
      5000
    );

    // Run one processing tick
    await (worker as any).processNextTask();

    const result = await db.getTask(task.id);
    expect(result?.status).toBe(TaskStatus.FAILED);
    expect(result?.error).toContain('Database connection reset during query');
  });

  it('should reject invalid state transitions with strict error', async () => {
    const task = await taskService.createTask({
      type: 'state_test',
      payload: {},
    });

    // PENDING cannot jump directly to SUCCESS without being QUEUED and RUNNING
    await expect(
      taskService.updateTaskStatus(task.id, TaskStatus.SUCCESS)
    ).rejects.toThrow('Invalid transition');
  });

  it('should return null when updating non-existent task IDs', async () => {
    const updated = await taskService.updateTaskStatus('missing_id_9999', TaskStatus.RUNNING);
    expect(updated).toBeNull();
  });

  it('should handle unhandled exceptions in event emitter without crashing other handlers', async () => {
    const emitter = new EventEmitter();
    let secondHandlerCalled = false;

    emitter.on(TaskEvent.CREATED, () => {
      throw new Error('Crashing listener');
    });

    emitter.on(TaskEvent.CREATED, () => {
      secondHandlerCalled = true;
    });

    await expect(
      emitter.emit(TaskEvent.CREATED, { taskId: 'task-123' })
    ).resolves.not.toThrow();

    expect(secondHandlerCalled).toBe(true);
  });
});
