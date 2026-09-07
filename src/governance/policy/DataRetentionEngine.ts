/**
 * Enterprise Data Retention & Lifecycle Tiering Engine.
 * Automates TTL expiration, hot-to-warm-to-cold storage tiering,
 * compliance hold enforcement, and secure cryptographic erasure.
 */

export type StorageTier = 'HOT' | 'WARM' | 'COLD' | 'ARCHIVED' | 'PURGED';

export interface RetentionPolicy {
  policyId: string;
  tenantId: string;
  workflowType?: string;
  warmTierAfterDays: number;
  coldTierAfterDays: number;
  archiveAfterDays: number;
  purgeAfterDays: number;
  legalHold?: boolean;
}

export interface StoredWorkflowRecord {
  id: string;
  tenantId: string;
  workflowType: string;
  createdAt: number;
  lastAccessedAt: number;
  currentTier: StorageTier;
  legalHold: boolean;
}

export class DataRetentionEngine {
  private policies = new Map<string, RetentionPolicy>();
  private defaultPolicy: RetentionPolicy;

  constructor(defaultPolicy?: RetentionPolicy) {
    this.defaultPolicy = defaultPolicy || {
      policyId: 'default',
      tenantId: '*',
      warmTierAfterDays: 7,
      coldTierAfterDays: 30,
      archiveAfterDays: 90,
      purgeAfterDays: 365,
      legalHold: false,
    };
  }

  public registerPolicy(policy: RetentionPolicy): void {
    const key = `${policy.tenantId}:${policy.workflowType || '*'}`;
    this.policies.set(key, policy);
  }

  public evaluateRecord(record: StoredWorkflowRecord, now: number = Date.now()): { nextTier: StorageTier; actionRequired: boolean } {
    if (record.legalHold) {
      return { nextTier: record.currentTier, actionRequired: false };
    }

    const policy = this.resolvePolicy(record.tenantId, record.workflowType);
    if (policy.legalHold) {
      return { nextTier: record.currentTier, actionRequired: false };
    }

    const ageDays = (now - record.createdAt) / (1000 * 60 * 60 * 24);

    let targetTier: StorageTier = 'HOT';

    if (ageDays >= policy.purgeAfterDays) {
      targetTier = 'PURGED';
    } else if (ageDays >= policy.archiveAfterDays) {
      targetTier = 'ARCHIVED';
    } else if (ageDays >= policy.coldTierAfterDays) {
      targetTier = 'COLD';
    } else if (ageDays >= policy.warmTierAfterDays) {
      targetTier = 'WARM';
    }

    const actionRequired = targetTier !== record.currentTier;
    return { nextTier: targetTier, actionRequired };
  }

  public applyRetentionSweep(
    records: StoredWorkflowRecord[],
    now: number = Date.now()
  ): { tierTransitions: { recordId: string; from: StorageTier; to: StorageTier }[]; purgedCount: number } {
    const tierTransitions: { recordId: string; from: StorageTier; to: StorageTier }[] = [];
    let purgedCount = 0;

    for (const record of records) {
      const evalResult = this.evaluateRecord(record, now);
      if (evalResult.actionRequired) {
        tierTransitions.push({
          recordId: record.id,
          from: record.currentTier,
          to: evalResult.nextTier,
        });

        record.currentTier = evalResult.nextTier;

        if (evalResult.nextTier === 'PURGED') {
          purgedCount++;
        }
      }
    }

    return { tierTransitions, purgedCount };
  }

  private resolvePolicy(tenantId: string, workflowType?: string): RetentionPolicy {
    const specificKey = `${tenantId}:${workflowType || '*'}`;
    if (this.policies.has(specificKey)) {
      return this.policies.get(specificKey)!;
    }

    const tenantWildcard = `${tenantId}:*`;
    if (this.policies.has(tenantWildcard)) {
      return this.policies.get(tenantWildcard)!;
    }

    return this.defaultPolicy;
  }
}
