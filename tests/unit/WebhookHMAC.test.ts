import { WebhookCrypto } from '../../src/webhooks/crypto/hmac';

describe('WebhookCrypto (HMAC-SHA256)', () => {
  const secret = 'super_secret_webhook_key_12345';
  const payload = JSON.stringify({ event: 'task.completed', taskId: 'task_abc_123' });

  it('should compute valid and consistent HMAC signatures', () => {
    const sig1 = WebhookCrypto.computeSignature(secret, payload);
    const sig2 = WebhookCrypto.computeSignature(secret, payload);

    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64); // SHA-256 hex string is 64 characters
  });

  it('should verify matching signatures correctly using timingSafeEqual', () => {
    const signature = WebhookCrypto.computeSignature(secret, payload);
    const isValid = WebhookCrypto.verifySignature(secret, payload, signature);

    expect(isValid).toBe(true);
  });

  it('should reject tampered payloads or invalid signatures', () => {
    const signature = WebhookCrypto.computeSignature(secret, payload);
    const tamperedPayload = JSON.stringify({ event: 'task.completed', taskId: 'task_tampered' });

    const isValid = WebhookCrypto.verifySignature(secret, tamperedPayload, signature);
    expect(isValid).toBe(false);

    const wrongKeyValid = WebhookCrypto.verifySignature('wrong_secret', payload, signature);
    expect(wrongKeyValid).toBe(false);
  });
});
