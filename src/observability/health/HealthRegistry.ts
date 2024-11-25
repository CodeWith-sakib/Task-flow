export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  details?: Record<string, any>;
  durationMs: number;
}

export type HealthCheckFn = () => Promise<{ status: HealthStatus; details?: Record<string, any> }>;

export class HealthRegistry {
  private checks: Map<string, HealthCheckFn> = new Map();

  register(name: string, checkFn: HealthCheckFn): void {
    this.checks.set(name, checkFn);
  }

  async runChecks(): Promise<{ overall: HealthStatus; checks: HealthCheckResult[] }> {
    const results: HealthCheckResult[] = [];
    let overall: HealthStatus = 'HEALTHY';

    for (const [name, fn] of this.checks.entries()) {
      const start = Date.now();
      try {
        const res = await fn();
        const durationMs = Date.now() - start;
        results.push({ name, status: res.status, details: res.details, durationMs });
        if (res.status === 'UNHEALTHY') {
          overall = 'UNHEALTHY';
        } else if (res.status === 'DEGRADED' && overall !== 'UNHEALTHY') {
          overall = 'DEGRADED';
        }
      } catch (err: any) {
        results.push({
          name,
          status: 'UNHEALTHY',
          details: { error: err?.message || 'Check failed' },
          durationMs: Date.now() - start,
        });
        overall = 'UNHEALTHY';
      }
    }

    return { overall, checks: results };
  }
}
