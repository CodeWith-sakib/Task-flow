import { WebhookDeadLetterVault } from '../../src/webhooks/WebhookDeadLetterVault';

describe('WebhookDeadLetterVault', () => {
  it('should store and redrive failed webhook records', () => {
    const vault = new WebhookDeadLetterVault();
    const stored = vault.store('https://example.com/hook', { val: 1 }, 'HTTP 500');

    expect(vault.list().length).toBe(1);
    const redriven = vault.redrive(stored.id);
    expect(redriven?.endpoint).toBe('https://example.com/hook');
    expect(vault.list().length).toBe(0);
  });
});
