export interface SamplerDecision {
  shouldSample: boolean;
  attributes: Record<string, string>;
}

/**
 * AdaptiveSampler implements tail-based and head-based adaptive sampling,
 * automatically elevating sampling rates for errors, slow requests, and priority tenants.
 */
export class AdaptiveSampler {
  private baseRate: number; // 0.0 to 1.0
  private maxTracesPerSecond: number;
  private currentSecondTraces: number = 0;
  private currentSecond: number = 0;
  private priorityTenants: Set<string>;

  constructor(baseRate: number = 0.1, maxTracesPerSecond: number = 100, priorityTenants: string[] = []) {
    this.baseRate = Math.min(1.0, Math.max(0.0, baseRate));
    this.maxTracesPerSecond = maxTracesPerSecond;
    this.priorityTenants = new Set(priorityTenants);
  }

  public shouldSample(traceId: string, context?: { tenantId?: string; isError?: boolean; latencyMs?: number }): SamplerDecision {
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec !== this.currentSecond) {
      this.currentSecond = nowSec;
      this.currentSecondTraces = 0;
    }

    // 1. Force sample on errors
    if (context?.isError) {
      return { shouldSample: true, attributes: { 'sample.reason': 'error_forced' } };
    }

    // 2. Force sample on high latency
    if (context?.latencyMs && context.latencyMs > 1000) {
      return { shouldSample: true, attributes: { 'sample.reason': 'latency_threshold' } };
    }

    // 3. Priority tenants receive 100% sampling
    if (context?.tenantId && this.priorityTenants.has(context.tenantId)) {
      return { shouldSample: true, attributes: { 'sample.reason': 'priority_tenant' } };
    }

    // 4. Rate-limited probabilistic sampling
    if (this.currentSecondTraces >= this.maxTracesPerSecond) {
      return { shouldSample: false, attributes: { 'sample.reason': 'rate_limited' } };
    }

    const hashVal = this.hashTraceId(traceId);
    const normalized = (hashVal % 10000) / 10000;
    const sampled = normalized < this.baseRate;

    if (sampled) {
      this.currentSecondTraces++;
    }

    return {
      shouldSample: sampled,
      attributes: { 'sample.reason': sampled ? 'probabilistic' : 'dropped' }
    };
  }

  private hashTraceId(traceId: string): number {
    let hash = 0;
    for (let i = 0; i < traceId.length; i++) {
      hash = ((hash << 5) - hash) + traceId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
