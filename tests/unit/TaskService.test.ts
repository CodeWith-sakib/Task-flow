import { createTestService } from '../setup';
import { TaskStatus } from '../../src/types';

describe('TaskService', () => {
  it('should create a task with PENDING status', async () => {
    const service = createTestService();

    const task = await service.createTask({
      type: 'email',
      payload: { to: 'test@example.com', subject: 'Test' },
      maxRetries: 3,
    });

    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.type).toBe('email');
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.retryCount).toBe(0);
    expect(task.maxRetries).toBe(3);
  });

  it('should retrieve a task by id', async () => {
    const service = createTestService();

    const created = await service.createTask({
      type: 'process',
      payload: { action: 'test' },
    });

    const retrieved = await service.getTask(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.type).toBe('process');
  });

  it('should return null for non-existent task', async () => {
    const service = createTestService();

    const task = await service.getTask('non-existent-id');

    expect(task).toBeNull();
  });

  it('should enqueue a task', async () => {
    const service = createTestService();

    const task = await service.createTask({
      type: 'delayed',
      payload: { delay: 5000 },
      scheduledAt: null,
    });

    // Initially PENDING, then auto-enqueued to QUEUED
    const retrieved = await service.getTask(task.id);
    expect(retrieved?.status).toBe(TaskStatus.QUEUED);
  });

  it('should get all tasks', async () => {
    const service = createTestService();

    await service.createTask({ type: 'task1', payload: {} });
    await service.createTask({ type: 'task2', payload: {} });

    const allTasks = await service.getAllTasks();

    expect(allTasks.length).toBeGreaterThanOrEqual(2);
  });

  it('should get tasks by status', async () => {
    const service = createTestService();

    const task = await service.createTask({
      type: 'test',
      payload: {},
    });

    const pending = await service.getTasksByStatus(TaskStatus.QUEUED);

    expect(pending.length).toBeGreaterThan(0);
    expect(pending.some((t: any) => t.id === task.id)).toBe(true);
  });
});
