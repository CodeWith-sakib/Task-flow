export interface TenantTier {
  name: string;
  refillRatePerSec: number;
  burstCapacity: number;
}

/**
 * TenantRateGovernor enforces per-tenant token bucket rate limits with dynamic burst allowances.
 */
export class TenantRateGovernor {
  private tenantBuckets: Map<string, { tokens: number; lastRefill: number; tier: TenantTier }> = new Map();
  private tiers: Map<string, TenantTier> = new Map();
  private defaultTier: TenantTier;

  constructor(defaultTier?: TenantTier) {
    this.defaultTier = defaultTier ?? {
      name: 'standard',
      refillRatePerSec: 50,
      burstCapacity: 100
    };
    this.tiers.set(this.defaultTier.name, this.defaultTier);
  }

  public registerTier(tier: TenantTier): void {
    this.tiers.set(tier.name, tier);
  }

  public setTenantTier(tenantId: string, tierName: string): void {
    const tier = this.tiers.get(tierName) || this.defaultTier;
    const bucket = this.tenantBuckets.get(tenantId);
    if (bucket) {
      bucket.tier = tier;
    } else {
      this.tenantBuckets.set(tenantId, {
        tokens: tier.burstCapacity,
        lastRefill: Date.now(),
        tier
      });
    }
  }

  public consume(tenantId: string, tokensRequested: number = 1): { allowed: boolean; remainingTokens: number } {
    const bucket = this.getOrCreateBucket(tenantId);
    this.refill(bucket);

    if (bucket.tokens >= tokensRequested) {
      bucket.tokens -= tokensRequested;
      return { allowed: true, remainingTokens: Math.floor(bucket.tokens) };
    }

    return { allowed: false, remainingTokens: Math.floor(bucket.tokens) };
  }

  private getOrCreateBucket(tenantId: string): { tokens: number; lastRefill: number; tier: TenantTier } {
    let bucket = this.tenantBuckets.get(tenantId);
    if (!bucket) {
      bucket = {
        tokens: this.defaultTier.burstCapacity,
        lastRefill: Date.now(),
        tier: this.defaultTier
      };
      this.tenantBuckets.set(tenantId, bucket);
    }
    return bucket;
  }

  private refill(bucket: { tokens: number; lastRefill: number; tier: TenantTier }): void {
    const now = Date.now();
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(bucket.tier.burstCapacity, bucket.tokens + elapsedSec * bucket.tier.refillRatePerSec);
    bucket.lastRefill = now;
  }
}
