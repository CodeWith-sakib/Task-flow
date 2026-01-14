import { TaskFlowCLI } from '../../src/cli/TaskFlowCLI';
import { TaskService } from '../../src/core/TaskService';
import { InMemoryDB } from '../../src/storage/db/InMemoryDB';
import { RedisQueueAbstraction } from '../../src/queue/redis/RedisQueueAbstraction';
import { EventEmitter } from '../../src/events/EventEmitter';
import { StateTransitioner } from '../../src/core/state/StateTransitioner';
import { RetryManager } from '../../src/core/retry/RetryManager';
import { TaskScheduler } from '../../src/core/scheduler/TaskScheduler';
import { TaskHandlerRegistry } from '../../src/core/lifecycle/TaskHandlerRegistry';

describe('TaskFlowCLI', () => {
  let cli: TaskFlowCLI;
  let taskService: TaskService;

  beforeEach(() => {
    const db = new InMemoryDB();
    const queue = new RedisQueueAbstraction();
    const emitter = new EventEmitter();
    const stateTransitioner = new StateTransitioner();
    const retryManager = new RetryManager();
    const scheduler = new TaskScheduler();
    const registry = new TaskHandlerRegistry();

    taskService = new TaskService(
      db,
      queue,
      emitter,
      stateTransitioner,
      retryManager,
      scheduler,
      registry
    );

    cli = new TaskFlowCLI(taskService);
  });

  it('should display help and version commands', async () => {
    const help = await cli.execute(['help']);
    expect(help.exitCode).toBe(0);
    expect(help.output).toContain('Usage:');

    const version = await cli.execute(['version']);
    expect(version.exitCode).toBe(0);
    expect(version.output).toContain('v1.0.0');
  });

  it('should submit a task through CLI and check status', async () => {
    const submit = await cli.execute(['submit', 'send_sms', '{"phone":"+123456789"}']);
    expect(submit.exitCode).toBe(0);
    expect(submit.output).toContain('Task created successfully:');

    const allTasks = await taskService.getAllTasks();
    const taskId = allTasks[0].id;

    const status = await cli.execute(['status', taskId]);
    expect(status.exitCode).toBe(0);
    expect(status.output).toContain(taskId);
    expect(status.output).toContain('send_sms');
  });

  it('should report healthy state', async () => {
    const health = await cli.execute(['health']);
    expect(health.exitCode).toBe(0);
    expect(health.output).toContain('healthy');
  });
});
