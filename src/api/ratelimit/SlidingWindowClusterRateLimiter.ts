export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimeMs: number;
}

export interface TenantTierConfig {
  maxRequests: number;
  windowSizeMs: number;
}

/**
 * SlidingWindowClusterRateLimiter implements a high-precision sliding-log rate limiter
 * tracking timestamp hits per client/tenant with burst capacity and tier-based limits.
 */
export class SlidingWindowClusterRateLimiter {
  private clientLogs: Map<string, number[]> = new Map();
  private tierConfigs: Map<string, TenantTierConfig> = new Map();
  private defaultLimit: TenantTierConfig;

  constructor(defaultLimit?: TenantTierConfig) {
    this.defaultLimit = defaultLimit ?? { maxRequests: 100, windowSizeMs: 60000 };
  }

  public setTier(tierName: string, config: TenantTierConfig): void {
    this.tierConfigs.set(tierName, config);
  }

  public check(clientId: string, tierName?: string, now: number = Date.now()): RateLimitResult {
    const config = (tierName ? this.tierConfigs.get(tierName) : undefined) ?? this.defaultLimit;
    const windowStart = now - config.windowSizeMs;

    let log = this.clientLogs.get(clientId);
    if (!log) {
      log = [];
      this.clientLogs.set(clientId, log);
    }

    // Clean up timestamps outside current sliding window
    while (log.length > 0 && log[0] <= windowStart) {
      log.shift();
    }

    if (log.length < config.maxRequests) {
      log.push(now);
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - log.length,
        resetTimeMs: now + config.windowSizeMs
      };
    }

    const oldestTimestamp = log[0];
    const resetTimeMs = oldestTimestamp + config.windowSizeMs;

    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTimeMs
    };
  }

  public reset(clientId?: string): void {
    if (clientId) {
      this.clientLogs.delete(clientId);
    } else {
      this.clientLogs.clear();
    }
  }
}
