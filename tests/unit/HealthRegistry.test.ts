import { HealthRegistry } from '../../src/observability/health/HealthRegistry';

describe('HealthRegistry Unit Tests', () => {
  it('should evaluate individual health checks and overall status', async () => {
    const reg = new HealthRegistry();
    reg.register('db', async () => ({ status: 'HEALTHY' }));
    reg.register('queue', async () => ({ status: 'DEGRADED', details: { latencyMs: 500 } }));

    const res = await reg.runChecks();
    expect(res.overall).toBe('DEGRADED');
    expect(res.checks.length).toBe(2);
  });
});
