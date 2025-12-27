import { TenantQuotaManager } from '../../src/security/tenant/TenantQuotaManager';

describe('TenantQuotaManager', () => {
  let quotaManager: TenantQuotaManager;

  beforeEach(() => {
    quotaManager = new TenantQuotaManager();
    quotaManager.setQuota({
      tenantId: 'tenant_limited',
      maxConcurrentTasks: 2,
      maxDailyTasks: 100,
      maxPayloadBytes: 1024,
    });
  });

  it('should enforce concurrency limits per tenant', () => {
    expect(quotaManager.checkAndAcquireConcurrentSlot('tenant_limited').allowed).toBe(true);
    expect(quotaManager.checkAndAcquireConcurrentSlot('tenant_limited').allowed).toBe(true);

    // Third concurrent slot should be rejected
    const third = quotaManager.checkAndAcquireConcurrentSlot('tenant_limited');
    expect(third.allowed).toBe(false);
    expect(third.reason).toContain('exceeded max concurrent tasks');

    // Releasing one allows new acquisition
    quotaManager.releaseConcurrentSlot('tenant_limited');
    expect(quotaManager.checkAndAcquireConcurrentSlot('tenant_limited').allowed).toBe(true);
  });

  it('should enforce payload byte limits', () => {
    expect(quotaManager.validatePayloadSize('tenant_limited', 500).allowed).toBe(true);
    expect(quotaManager.validatePayloadSize('tenant_limited', 2048).allowed).toBe(false);
  });
});
