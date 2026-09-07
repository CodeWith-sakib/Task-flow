export interface DeadLetteredWebhook {
  id: string;
  url: string;
  payload: any;
  tenantId: string;
  failureReason: string;
  attemptsUsed: number;
  lastAttemptAt: number;
  status: 'PENDING' | 'REPLAYED' | 'DISCARDED';
}

/**
 * WebhookDeadLetterVault persists unroutable, permanently failed, or exhausted webhooks
 * and facilitates manual or automated batch replaying.
 */
export class WebhookDeadLetterVault {
  private vault: Map<string, DeadLetteredWebhook> = new Map();
  private maxCapacity: number;

  constructor(maxCapacity: number = 10000) {
    this.maxCapacity = maxCapacity;
  }

  public store(
    id: string,
    url: string,
    payload: any,
    tenantId: string,
    failureReason: string,
    attemptsUsed: number
  ): DeadLetteredWebhook {
    if (this.vault.size >= this.maxCapacity) {
      // Evict oldest record
      const oldestKey = this.vault.keys().next().value;
      if (oldestKey) this.vault.delete(oldestKey);
    }

    const record: DeadLetteredWebhook = {
      id,
      url,
      payload,
      tenantId,
      failureReason,
      attemptsUsed,
      lastAttemptAt: Date.now(),
      status: 'PENDING'
    };

    this.vault.set(id, record);
    return record;
  }

  public get(id: string): DeadLetteredWebhook | undefined {
    return this.vault.get(id);
  }

  public query(filter?: { tenantId?: string; status?: DeadLetteredWebhook['status'] }): DeadLetteredWebhook[] {
    return Array.from(this.vault.values()).filter(item => {
      if (filter?.tenantId && item.tenantId !== filter.tenantId) return false;
      if (filter?.status && item.status !== filter.status) return false;
      return true;
    });
  }

  public markReplayed(id: string): boolean {
    const item = this.vault.get(id);
    if (!item) return false;
    item.status = 'REPLAYED';
    return true;
  }

  public markDiscarded(id: string): boolean {
    const item = this.vault.get(id);
    if (!item) return false;
    item.status = 'DISCARDED';
    return true;
  }

  public clear(): void {
    this.vault.clear();
  }

  public size(): number {
    return this.vault.size;
  }
}
