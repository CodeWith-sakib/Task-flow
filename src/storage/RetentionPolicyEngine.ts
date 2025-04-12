export interface RetentionRecord {
  id: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  finishedAt: number;
}

export class RetentionPolicyEngine {
  private retentionMs: { COMPLETED: number; FAILED: number; CANCELLED: number };

  constructor(config: { completedDays?: number; failedDays?: number; cancelledDays?: number } = {}) {
    const day = 86400000;
    this.retentionMs = {
      COMPLETED: (config.completedDays ?? 7) * day,
      FAILED: (config.failedDays ?? 30) * day,
      CANCELLED: (config.cancelledDays ?? 14) * day
    };
  }

  public isExpired(record: RetentionRecord, now: number = Date.now()): boolean {
    const limit = this.retentionMs[record.status] || 7 * 86400000;
    return (now - record.finishedAt) >= limit;
  }

  public filterExpired(records: RetentionRecord[], now: number = Date.now()): { active: RetentionRecord[]; expired: RetentionRecord[] } {
    const active: RetentionRecord[] = [];
    const expired: RetentionRecord[] = [];

    for (const r of records) {
      if (this.isExpired(r, now)) {
        expired.push(r);
      } else {
        active.push(r);
      }
    }

    return { active, expired };
  }
}
