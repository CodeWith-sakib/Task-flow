import * as fs from 'fs';
import * as path from 'path';
import { WALDatabaseAdapter } from '../../src/storage/db/WALDatabaseAdapter';
import { TaskStatus } from '../../src/types';

describe('WALDatabaseAdapter Unit Tests', () => {
  const testDir = path.join(process.cwd(), 'tmp_test_wal_adapter');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should persist and retrieve tasks through the WAL storage engine', async () => {
    const adapter = new WALDatabaseAdapter(testDir);
    await adapter.init();

    const task = await adapter.createTask({
      type: 'wal_adapter_test',
      payload: { data: 'test_wal' },
      priority: 10,
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe(TaskStatus.PENDING);

    const fetched = await adapter.getTask(task.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(task.id);
    expect(fetched?.type).toBe('wal_adapter_test');

    const updated = await adapter.updateTask(task.id, {
      status: TaskStatus.RUNNING,
    });
    expect(updated?.status).toBe(TaskStatus.RUNNING);

    const all = await adapter.getAllTasks();
    expect(all.length).toBe(1);

    const byStatus = await adapter.getTasksByStatus(TaskStatus.RUNNING);
    expect(byStatus.length).toBe(1);
    expect(byStatus[0].id).toBe(task.id);

    const stats = await adapter.getStats();
    expect(stats.totalTasks).toBe(1);
    expect(stats.countsByStatus[TaskStatus.RUNNING]).toBe(1);

    await adapter.close();
  });
});
