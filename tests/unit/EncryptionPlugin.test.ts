import { EncryptionPlugin } from '../../src/plugins/builtin/EncryptionPlugin';
import { Task, TaskStatus } from '../../src/types';

describe('EncryptionPlugin Unit Tests', () => {
  it('should transparently encrypt before creation and decrypt before execution', async () => {
    const plugin = new EncryptionPlugin();
    const req = await plugin.beforeCreateTask({
      type: 'secure_task',
      payload: { sensitiveToken: 'sk_live_123456' },
    });
    expect(req.payload.__encrypted).toBe(true);

    const task: Task = {
      id: 'enc-1',
      type: 'secure_task',
      status: TaskStatus.PENDING,
      priority: 0,
      payload: req.payload,
      retryCount: 0,
      maxRetries: 3,
      scheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const decryptedTask = await plugin.beforeExecuteTask(task);
    expect(decryptedTask.payload.__encrypted).toBeUndefined();
    expect(decryptedTask.payload.sensitiveToken).toBe('sk_live_123456');
  });
});
