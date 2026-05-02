export interface DeadWebhook {
  id: string;
  endpoint: string;
  payload: Record<string, unknown>;
  failureReason: string;
  storedAt: number;
}

export class WebhookDeadLetterVault {
  private deadWebhooks: DeadWebhook[] = [];

  public store(endpoint: string, payload: Record<string, unknown>, failureReason: string): DeadWebhook {
    const record: DeadWebhook = {
      id: Math.random().toString(36).substring(2, 9),
      endpoint,
      payload,
      failureReason,
      storedAt: Date.now()
    };
    this.deadWebhooks.push(record);
    return record;
  }

  public list(): DeadWebhook[] {
    return [...this.deadWebhooks];
  }

  public redrive(id: string): DeadWebhook | undefined {
    const idx = this.deadWebhooks.findIndex(w => w.id === id);
    if (idx !== -1) {
      return this.deadWebhooks.splice(idx, 1)[0];
    }
    return undefined;
  }
}
