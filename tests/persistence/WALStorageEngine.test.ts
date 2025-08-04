import * as fs from 'fs';
import * as path from 'path';
import { WALStorageEngine } from '../../src/storage/wal/WALStorageEngine';
import { Task, TaskStatus } from '../../src/types';

describe('WALStorageEngine (Persistence)', () => {
  const testDir = path.join(__dirname, '../temp_wal_test');
  let engine: WALStorageEngine;

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    engine = new WALStorageEngine(testDir);
    await engine.init();
  });

  afterEach(async () => {
    await engine.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const createTask = (id: string, type: string = 'email', priority: number = 10): Task => ({
    id,
    type,
    payload: { recipient: 'test@example.com' },
    status: TaskStatus.PENDING,
    retryCount: 0,
    maxRetries: 3,
    scheduledAt: null,
    priority,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('should persist tasks and survive engine restarts', async () => {
    const t1 = createTask('wal_1', 'email', 5);
    const t2 = createTask('wal_2', 'report', 20);

    await engine.createTask(t1);
    await engine.createTask(t2);
    await engine.updateTask('wal_1', { status: TaskStatus.SUCCESS });

    // Close current engine instance
    await engine.close();

    // Instantiate new engine on identical storage directory
    const recoveredEngine = new WALStorageEngine(testDir);
    await recoveredEngine.init();

    const recoveredT1 = await recoveredEngine.getTask('wal_1');
    const recoveredT2 = await recoveredEngine.getTask('wal_2');

    expect(recoveredT1).not.toBeNull();
    expect(recoveredT1?.status).toBe(TaskStatus.SUCCESS);
    expect(recoveredT2).not.toBeNull();
    expect(recoveredT2?.status).toBe(TaskStatus.PENDING);
    expect(recoveredT2?.priority).toBe(20);

    await recoveredEngine.close();
  });

  it('should support snapshot compaction and reload from snapshot', async () => {
    for (let i = 1; i <= 5; i++) {
      await engine.createTask(createTask(`task_${i}`, 'batch', i * 10));
    }

    await engine.compact();

    // Verify snapshot file exists
    const snapshotPath = path.join(testDir, 'snapshot.json');
    expect(fs.existsSync(snapshotPath)).toBe(true);

    // Restart engine
    await engine.close();
    const restartedEngine = new WALStorageEngine(testDir);
    await restartedEngine.init();

    const stats = await restartedEngine.getStats();
    expect(stats.totalTasks).toBe(5);
    expect(stats.countsByStatus[TaskStatus.PENDING]).toBe(5);

    await restartedEngine.close();
  });

  it('should query tasks with secondary index and pagination', async () => {
    await engine.createTask(createTask('q1', 'email', 5));
    await engine.createTask(createTask('q2', 'webhook', 15));
    await engine.createTask(createTask('q3', 'email', 25));
    await engine.updateTask('q2', { status: TaskStatus.RUNNING });

    const emailQuery = await engine.queryTasks({ type: 'email' });
    expect(emailQuery.total).toBe(2);

    const priorityQuery = await engine.queryTasks({ priorityMin: 10, priorityMax: 30 });
    expect(priorityQuery.total).toBe(2);

    const paged = await engine.queryTasks({ limit: 2, offset: 0 });
    expect(paged.tasks.length).toBe(2);
    expect(paged.hasMore).toBe(true);
  });

  it('should commit transaction operations atomically', async () => {
    const tx = await engine.beginTransaction();
    await tx.createTask(createTask('tx_1', 'order', 1));
    await tx.createTask(createTask('tx_2', 'order', 2));
    await tx.commit();

    const t1 = await engine.getTask('tx_1');
    const t2 = await engine.getTask('tx_2');
    expect(t1).not.toBeNull();
    expect(t2).not.toBeNull();
  });

  it('should rollback transaction operations without persisting', async () => {
    const tx = await engine.beginTransaction();
    await tx.createTask(createTask('tx_abort', 'order', 1));
    await tx.rollback();

    const aborted = await engine.getTask('tx_abort');
    expect(aborted).toBeNull();
  });
});
