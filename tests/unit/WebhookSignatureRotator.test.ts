import { WebhookSignatureRotator } from '../../src/webhooks/WebhookSignatureRotator';

describe('WebhookSignatureRotator', () => {
  it('should verify signatures signed by either primary or secondary secret', () => {
    const rotator = new WebhookSignatureRotator('primary-secret', 'old-secret');
    const payload = JSON.stringify({ event: 'task.completed' });

    const primarySig = rotator.sign(payload);
    expect(rotator.verify(payload, primarySig)).toBe(true);

    const oldRotator = new WebhookSignatureRotator('old-secret');
    const oldSig = oldRotator.sign(payload);
    expect(rotator.verify(payload, oldSig)).toBe(true);

    expect(rotator.verify(payload, 'corrupt-sig')).toBe(false);
  });
});
