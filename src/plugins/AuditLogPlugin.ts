export interface AuditEntry {
  actor: string;
  action: string;
  targetId: string;
  timestamp: number;
}

export class AuditLogPlugin {
  private logs: AuditEntry[] = [];

  public log(actor: string, action: string, targetId: string): void {
    this.logs.push({
      actor,
      action,
      targetId,
      timestamp: Date.now()
    });
  }

  public getLogs(): AuditEntry[] {
    return [...this.logs];
  }
}
