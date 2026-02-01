import { DeduplicationPlugin } from '../../src/plugins/builtin/DeduplicationPlugin';

describe('DeduplicationPlugin', () => {
  it('should allow first submission and reject duplicate within window', async () => {
    const plugin = new DeduplicationPlugin(1000); // 1s window

    const req = {
      type: 'send_receipt',
      payload: { orderId: 'ord_123', amount: 50 },
    };

    // First submission allowed
    await expect(plugin.beforeCreateTask(req)).resolves.toEqual(req);

    // Immediate second submission with identical payload rejected
    await expect(plugin.beforeCreateTask(req)).rejects.toThrow('Duplicate task submission detected');
  });

  it('should allow identical task after deduplication window expires', async () => {
    const plugin = new DeduplicationPlugin(50); // 50ms window

    const req = {
      type: 'process_payment',
      payload: { id: 'p_1' },
    };

    await plugin.beforeCreateTask(req);

    // Wait for window expiration
    await new Promise(r => setTimeout(r, 60));

    // Allowed again
    await expect(plugin.beforeCreateTask(req)).resolves.toEqual(req);
  });
});
