import { BatchWebhookNotifier } from '../../src/webhooks/BatchWebhookNotifier';

describe('BatchWebhookNotifier', () => {
  it('should collect events and trigger flush on batch size', () => {
    const notifier = new BatchWebhookNotifier(2);
    expect(notifier.enqueue({ a: 1 })).toBe(false);
    expect(notifier.enqueue({ b: 2 })).toBe(true);

    const batch = notifier.flush();
    expect(batch.length).toBe(2);
    expect(notifier.size()).toBe(0);
  });
});
