import { WebhookDispatcher, HttpTransport } from '../../src/webhooks/WebhookDispatcher';
import { WebhookCrypto } from '../../src/webhooks/crypto/hmac';

describe('WebhookDispatcher Unit Tests', () => {
  it('should register, retrieve, and remove subscriptions', () => {
    const dispatcher = new WebhookDispatcher();
    const sub = dispatcher.registerSubscription({
      url: 'https://webhook.site/test',
      events: ['task_completed', 'task_failed'],
      secret: 'whsec_test_secret_123',
      status: 'ACTIVE',
    });

    expect(sub.id).toBeDefined();
    expect(sub.failureCount).toBe(0);
    expect(dispatcher.getSubscriptions().length).toBe(1);

    const removed = dispatcher.removeSubscription(sub.id);
    expect(removed).toBe(true);
    expect(dispatcher.getSubscriptions().length).toBe(0);
  });

  it('should dispatch webhooks to active subscriptions with valid HMAC signatures', async () => {
    const sentRequests: Array<{ url: string; payload: string; headers: Record<string, string> }> = [];

    const mockTransport: HttpTransport = async (url, payload, headers) => {
      sentRequests.push({ url, payload, headers });
      return { statusCode: 200, body: 'ok' };
    };

    const dispatcher = new WebhookDispatcher(mockTransport);
    const secret = 'whsec_secret_signature_test';

    const subActive = dispatcher.registerSubscription({
      url: 'https://api.example.com/hooks',
      events: ['task_completed'],
      secret,
      status: 'ACTIVE',
    });

    const subInactive = dispatcher.registerSubscription({
      url: 'https://api.example.com/inactive',
      events: ['task_completed'],
      secret,
      status: 'DISABLED',
    });

    const results = await dispatcher.dispatch('task_completed', 'task_99', { result: 'done' });
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].statusCode).toBe(200);
    expect(results[0].subscriptionId).toBe(subActive.id);

    expect(sentRequests.length).toBe(1);
    const req = sentRequests[0];
    expect(req.url).toBe('https://api.example.com/hooks');

    // Verify HMAC signature
    const sigHeader = req.headers['X-TaskFlow-Signature'];
    expect(sigHeader).toBeDefined();
    const sig = sigHeader.replace('sha256=', '');
    const isValid = WebhookCrypto.verifySignature(secret, req.payload, sig);
    expect(isValid).toBe(true);
  });

  it('should trigger circuit breaker trips upon consecutive delivery failures', async () => {
    let callCount = 0;
    const failingTransport: HttpTransport = async () => {
      callCount++;
      return { statusCode: 503, body: 'Service Unavailable' };
    };

    const dispatcher = new WebhookDispatcher(failingTransport);
    const url = 'https://unreliable.service/hook';

    dispatcher.registerSubscription({
      url,
      events: ['task_failed'],
      secret: 'secret',
      status: 'ACTIVE',
    });

    const breaker = dispatcher.getCircuitBreaker(url);
    // Failure threshold defaults to 3 failures
    for (let i = 0; i < 3; i++) {
      const results = await dispatcher.dispatch('task_failed', 'task-x', {});
      expect(results[0].success).toBe(false);
      expect(results[0].statusCode).toBe(503);
    }

    expect(breaker.getState()).toBe('OPEN');

    // 4th call should be rejected immediately by circuit breaker without hitting transport
    const fastFailResults = await dispatcher.dispatch('task_failed', 'task-x', {});
    expect(fastFailResults[0].success).toBe(false);
    expect(fastFailResults[0].error).toContain('Circuit breaker OPEN');
    expect(callCount).toBe(3); // Did not increase
  });
});
