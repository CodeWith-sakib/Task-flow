import { Application } from '../../src/index';
import { TaskStatus } from '../../src/types';
import { simulateRequest } from '../api/httpSimulator';

describe('Full System End-to-End Workflow', () => {
  let app: Application;

  beforeEach(() => {
    app = new Application();
  });

  afterEach(async () => {
    const worker = app.getWorker();
    if (worker) {
      worker.stop();
    }
  });

  it('should execute end-to-end task submission, worker processing, metrics emission, and dashboard reflection', async () => {
    // 1. Check system is initially healthy and metrics/status respond
    const healthRes = await simulateRequest(app.getApp(), {
      method: 'GET',
      url: '/health',
    });
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('healthy');

    // 2. Register worker handler in taskHandlerRegistry for this task type before task runs
    let executionDone = false;
    app.getTaskService().registerHandler('e2e_benchmark_task', async (payload) => {
      expect(payload.value).toBe(42);
      executionDone = true;
      return { status: 'processed', answer: 84 };
    });

    // 3. Submit task via REST API simulator
    const createRes = await simulateRequest(app.getApp(), {
      method: 'POST',
      url: '/api/tasks',
      body: {
        type: 'e2e_benchmark_task',
        payload: { value: 42, computeType: 'fast' },
        priority: 10,
      },
    });
    expect(createRes.status).toBe(201);
    const taskId = createRes.body.task?.id || createRes.body.id;
    expect(taskId).toBeDefined();

    // 4. Trigger one processing tick on the worker directly
    const worker = app.getWorker();
    expect(worker).not.toBeNull();
    await (worker as any).processNextTask();
    expect(executionDone).toBe(true);

    // 5. Query task status via REST API simulator
    const getRes = await simulateRequest(app.getApp(), {
      method: 'GET',
      url: `/api/tasks/${taskId}`,
    });
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe(TaskStatus.SUCCESS);

    // 6. Verify Prometheus metrics updated
    const metricsRes = await simulateRequest(app.getApp(), {
      method: 'GET',
      url: '/metrics',
    });
    expect(metricsRes.status).toBe(200);
    expect(metricsRes.headers['content-type']).toContain('text/plain');
    expect(metricsRes.text).toContain('tasks_created_total');
    expect(metricsRes.text).toContain('tasks_completed_total');

    // 7. Verify Status Dashboard HTML renders state correctly
    const statusRes = await simulateRequest(app.getApp(), {
      method: 'GET',
      url: '/status',
    });
    expect(statusRes.status).toBe(200);
    expect(statusRes.headers['content-type']).toContain('text/html');
    expect(statusRes.text).toContain('TaskFlow Engine');
    expect(statusRes.text).toContain('e2e_benchmark_task');
  });
});
