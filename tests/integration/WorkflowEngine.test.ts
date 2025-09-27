import { WorkflowEngine } from '../../src/workflows/WorkflowEngine';
import { WorkflowDefinition, WorkflowStatus } from '../../src/workflows/types';
import { TaskService } from '../../src/core/TaskService';
import { InMemoryDB } from '../../src/storage/db/InMemoryDB';
import { RedisQueueAbstraction } from '../../src/queue/redis/RedisQueueAbstraction';
import { EventEmitter } from '../../src/events/EventEmitter';
import { StateTransitioner } from '../../src/core/state/StateTransitioner';
import { RetryManager } from '../../src/core/retry/RetryManager';
import { TaskScheduler } from '../../src/core/scheduler/TaskScheduler';
import { TaskHandlerRegistry } from '../../src/core/lifecycle/TaskHandlerRegistry';

describe('WorkflowEngine Integration', () => {
  let taskService: TaskService;
  let workflowEngine: WorkflowEngine;
  let db: InMemoryDB;

  beforeEach(() => {
    db = new InMemoryDB();
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

    workflowEngine = new WorkflowEngine(taskService);
  });

  it('should execute a multi-step sequential workflow and pass context forward', async () => {
    const wf: WorkflowDefinition = {
      id: 'data_pipeline',
      name: 'Data Pipeline',
      version: 1,
      steps: [
        {
          id: 'fetch_data',
          taskType: 'http_fetch',
          payload: { url: 'https://api.example.com/items' },
        },
        {
          id: 'process_data',
          taskType: 'data_transform',
          dependsOn: ['fetch_data'],
          payload: (ctx) => ({ rawItems: ctx.fetch_data }),
        },
      ],
    };

    workflowEngine.registerWorkflow(wf);
    const execution = await workflowEngine.startWorkflow('data_pipeline');

    expect(execution.status).toBe(WorkflowStatus.RUNNING);
    const step1State = execution.stepStates.get('fetch_data');
    expect(step1State?.taskId).toBeDefined();

    // Simulate Step 1 completion
    await workflowEngine.handleTaskCompletion(step1State!.taskId!, { count: 42, items: [1, 2] });

    // Step 2 should now be queued with output passed into context
    const step2State = execution.stepStates.get('process_data');
    expect(step2State?.taskId).toBeDefined();
    expect(execution.context.fetch_data).toEqual({ count: 42, items: [1, 2] });

    // Simulate Step 2 completion
    await workflowEngine.handleTaskCompletion(step2State!.taskId!, { success: true });

    expect(execution.status).toBe(WorkflowStatus.COMPLETED);
    expect(execution.completedAt).toBeDefined();
  });

  it('should trigger Saga compensation tasks on step failure', async () => {
    const wf: WorkflowDefinition = {
      id: 'order_saga',
      name: 'Order Saga',
      version: 1,
      steps: [
        {
          id: 'reserve_credit',
          taskType: 'credit_reserve',
          compensationType: 'credit_release',
        },
        {
          id: 'ship_order',
          taskType: 'order_shipment',
          dependsOn: ['reserve_credit'],
        },
      ],
    };

    workflowEngine.registerWorkflow(wf);
    const execution = await workflowEngine.startWorkflow('order_saga');

    const step1TaskId = execution.stepStates.get('reserve_credit')!.taskId!;
    await workflowEngine.handleTaskCompletion(step1TaskId, { reservationId: 'res_999' });

    const step2TaskId = execution.stepStates.get('ship_order')!.taskId!;
    // Simulate failure in step 2
    await workflowEngine.handleTaskFailure(step2TaskId, 'Out of stock');

    expect(execution.status).toBe(WorkflowStatus.FAILED);
    expect(execution.error).toContain("Step 'ship_order' failed: Out of stock");

    // Verify compensation task was created in TaskService / DB
    const allTasks = await db.getAllTasks();
    const compensationTask = allTasks.find(t => t.type === 'credit_release');
    expect(compensationTask).toBeDefined();
    expect(compensationTask?.payload.originalOutput).toEqual({ reservationId: 'res_999' });
  });

  it('should allow canceling a running workflow', async () => {
    const wf: WorkflowDefinition = {
      id: 'cancel_me',
      name: 'Cancel Me',
      version: 1,
      steps: [{ id: 's1', taskType: 'dummy' }],
    };

    workflowEngine.registerWorkflow(wf);
    const execution = await workflowEngine.startWorkflow('cancel_me');
    const cancelled = await workflowEngine.cancelWorkflow(execution.id);

    expect(cancelled).toBe(true);
    expect(execution.status).toBe(WorkflowStatus.CANCELLED);
  });
});
