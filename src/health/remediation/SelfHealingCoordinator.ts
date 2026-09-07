export type RemediationActionType =
  | 'TRIGGER_STORAGE_FLUSH'
  | 'SCALE_UP_WORKERS'
  | 'THROTTLE_INGESTION'
  | 'RESTART_STUCK_WORKERS'
  | 'DRAIN_NODE';

export interface RemediationPlan {
  action: RemediationActionType;
  targetSubsystem: string;
  reason: string;
  timestamp: number;
}

export type RemediationExecutor = (action: RemediationActionType) => Promise<boolean>;

/**
 * SelfHealingCoordinator triggers automated remediation actions when system health probes degrade.
 */
export class SelfHealingCoordinator {
  private remediationHistory: RemediationPlan[] = [];
  private executor?: RemediationExecutor;

  constructor(executor?: RemediationExecutor) {
    this.executor = executor;
  }

  public async evaluateAndRemediate(probeReports: { subsystem: string; status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'; message?: string }[]): Promise<RemediationPlan[]> {
    const actions: RemediationPlan[] = [];

    for (const report of probeReports) {
      if (report.status === 'UNHEALTHY') {
        let action: RemediationActionType = 'THROTTLE_INGESTION';
        if (report.subsystem === 'storage') {
          action = 'TRIGGER_STORAGE_FLUSH';
        } else if (report.subsystem === 'queue' || report.subsystem === 'workers') {
          action = 'SCALE_UP_WORKERS';
        }

        const plan: RemediationPlan = {
          action,
          targetSubsystem: report.subsystem,
          reason: report.message || `Subsystem ${report.subsystem} reported UNHEALTHY`,
          timestamp: Date.now()
        };

        actions.push(plan);
        this.remediationHistory.push(plan);

        if (this.executor) {
          await this.executor(action);
        }
      }
    }

    return actions;
  }

  public getHistory(): RemediationPlan[] {
    return [...this.remediationHistory];
  }
}
