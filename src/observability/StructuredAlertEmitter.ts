export interface AlertMessage {
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  title: string;
  details: Record<string, unknown>;
  timestamp: number;
}

export class StructuredAlertEmitter {
  private alerts: AlertMessage[] = [];

  public emit(severity: 'INFO' | 'WARN' | 'CRITICAL', title: string, details: Record<string, unknown>): AlertMessage {
    const msg: AlertMessage = {
      severity,
      title,
      details,
      timestamp: Date.now()
    };
    this.alerts.push(msg);
    return msg;
  }

  public getCriticalAlerts(): AlertMessage[] {
    return this.alerts.filter(a => a.severity === 'CRITICAL');
  }
}
