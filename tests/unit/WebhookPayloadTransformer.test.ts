import { WebhookPayloadTransformer } from '../../src/webhooks/WebhookPayloadTransformer';

describe('WebhookPayloadTransformer', () => {
  it('should format outbound event into CloudEvents-style envelope', () => {
    const envelope = WebhookPayloadTransformer.transform('task_completed', { taskId: 'abc' });
    expect(envelope.type).toBe('com.taskflow.task_completed');
    expect(envelope.specVersion).toBe('1.0');
    expect((envelope.data as any).taskId).toBe('abc');
  });
});
