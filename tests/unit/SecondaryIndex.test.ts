import { SecondaryIndex } from '../../src/storage/index/SecondaryIndex';
import { Task, TaskStatus } from '../../src/types';

describe('SecondaryIndex', () => {
  let index: SecondaryIndex;

  beforeEach(() => {
    index = new SecondaryIndex();
  });

  const createTask = (id: string, status: TaskStatus, type: string, priority: number): Task => ({
    id,
    type,
    payload: {},
    status,
    retryCount: 0,
    maxRetries: 3,
    scheduledAt: null,
    priority,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('should index and retrieve task IDs by status', () => {
    const t1 = createTask('1', TaskStatus.PENDING, 'email', 1);
    const t2 = createTask('2', TaskStatus.RUNNING, 'webhook', 2);
    const t3 = createTask('3', TaskStatus.PENDING, 'email', 3);

    index.index(t1);
    index.index(t2);
    index.index(t3);

    const pending = index.getByStatus(TaskStatus.PENDING);
    expect(pending.has('1')).toBe(true);
    expect(pending.has('3')).toBe(true);
    expect(pending.size).toBe(2);

    const running = index.getByStatus(TaskStatus.RUNNING);
    expect(running.has('2')).toBe(true);
    expect(running.size).toBe(1);
  });

  it('should update indices when a task status changes', () => {
    const t1 = createTask('1', TaskStatus.PENDING, 'email', 1);
    index.index(t1);

    expect(index.getByStatus(TaskStatus.PENDING).has('1')).toBe(true);

    const updated = { ...t1, status: TaskStatus.RUNNING };
    index.index(updated);

    expect(index.getByStatus(TaskStatus.PENDING).has('1')).toBe(false);
    expect(index.getByStatus(TaskStatus.RUNNING).has('1')).toBe(true);
  });

  it('should find tasks within priority range', () => {
    index.index(createTask('1', TaskStatus.PENDING, 'email', 10));
    index.index(createTask('2', TaskStatus.PENDING, 'email', 25));
    index.index(createTask('3', TaskStatus.PENDING, 'email', 50));

    const matched = index.getByPriorityRange(15, 30);
    expect(matched.size).toBe(1);
    expect(matched.has('2')).toBe(true);
  });

  it('should compute status counts accurately', () => {
    index.index(createTask('1', TaskStatus.PENDING, 'email', 0));
    index.index(createTask('2', TaskStatus.SUCCESS, 'email', 0));
    index.index(createTask('3', TaskStatus.SUCCESS, 'email', 0));

    const counts = index.countByStatus();
    expect(counts[TaskStatus.PENDING]).toBe(1);
    expect(counts[TaskStatus.SUCCESS]).toBe(2);
    expect(counts[TaskStatus.FAILED]).toBe(0);
  });
});
