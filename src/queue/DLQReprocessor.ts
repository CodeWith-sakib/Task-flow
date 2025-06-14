export interface DLQItem<T> {
  id: string;
  payload: T;
  retryCount: number;
  lastError: string;
}

export class DLQReprocessor<T> {
  private maxRetries: number;
  private quarantined: DLQItem<T>[] = [];

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }

  public processItem(item: DLQItem<T>): { action: 'RETRY' | 'QUARANTINE' } {
    if (item.retryCount >= this.maxRetries) {
      this.quarantined.push(item);
      return { action: 'QUARANTINE' };
    }
    item.retryCount++;
    return { action: 'RETRY' };
  }

  public getQuarantined(): DLQItem<T>[] {
    return this.quarantined;
  }
}
