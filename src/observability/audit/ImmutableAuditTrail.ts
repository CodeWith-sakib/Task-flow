import * as crypto from 'crypto';

export interface AuditRecord {
  sequence: number;
  timestamp: number;
  actor: string;
  action: string;
  resource: string;
  tenantId: string;
  details: Record<string, any>;
  previousHash: string;
  hash: string;
}

/**
 * ImmutableAuditTrail maintains a tamper-evident, cryptographically chained audit log
 * linking each administrative and execution event to previous event hashes (Merkle chain).
 */
export class ImmutableAuditTrail {
  private records: AuditRecord[] = [];
  private currentHash: string = '0'.repeat(64); // Genesis hash
  private sequence: number = 0;

  public log(
    actor: string,
    action: string,
    resource: string,
    tenantId: string,
    details: Record<string, any> = {}
  ): AuditRecord {
    this.sequence++;
    const timestamp = Date.now();
    const previousHash = this.currentHash;

    const payloadToHash = `${this.sequence}:${timestamp}:${actor}:${action}:${resource}:${tenantId}:${JSON.stringify(details)}:${previousHash}`;
    const hash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const record: AuditRecord = {
      sequence: this.sequence,
      timestamp,
      actor,
      action,
      resource,
      tenantId,
      details,
      previousHash,
      hash
    };

    this.records.push(record);
    this.currentHash = hash;
    return record;
  }

  public verifyIntegrity(): { isValid: boolean; brokenAtSequence?: number } {
    let expectedPrevious = '0'.repeat(64);

    for (let i = 0; i < this.records.length; i++) {
      const rec = this.records[i];

      if (rec.previousHash !== expectedPrevious) {
        return { isValid: false, brokenAtSequence: rec.sequence };
      }

      const payload = `${rec.sequence}:${rec.timestamp}:${rec.actor}:${rec.action}:${rec.resource}:${rec.tenantId}:${JSON.stringify(rec.details)}:${rec.previousHash}`;
      const computedHash = crypto.createHash('sha256').update(payload).digest('hex');

      if (computedHash !== rec.hash) {
        return { isValid: false, brokenAtSequence: rec.sequence };
      }

      expectedPrevious = rec.hash;
    }

    return { isValid: true };
  }

  public query(filter?: { tenantId?: string; actor?: string; action?: string }): AuditRecord[] {
    return this.records.filter(r => {
      if (filter?.tenantId && r.tenantId !== filter.tenantId) return false;
      if (filter?.actor && r.actor !== filter.actor) return false;
      if (filter?.action && r.action !== filter.action) return false;
      return true;
    });
  }

  public size(): number {
    return this.records.length;
  }
}
