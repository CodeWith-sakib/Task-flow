export interface QuarantineRecord<T> {
  id: string;
  payload: T;
  reason: string;
  quarantinedAt: number;
}

export class PoisonMessageQuarantine<T> {
  private records: Map<string, QuarantineRecord<T>> = new Map();

  public quarantine(id: string, payload: T, reason: string): void {
    this.records.set(id, {
      id,
      payload,
      reason,
      quarantinedAt: Date.now()
    });
  }

  public isQuarantined(id: string): boolean {
    return this.records.has(id);
  }

  public release(id: string): QuarantineRecord<T> | undefined {
    const record = this.records.get(id);
    if (record) {
      this.records.delete(id);
    }
    return record;
  }

  public count(): number {
    return this.records.size;
  }
}
