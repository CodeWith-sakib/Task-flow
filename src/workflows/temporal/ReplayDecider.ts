import { HistoryEvent, HistoryEventType } from './HistoryEvents';

export interface DeciderState {
  workflowId: string;
  isReplaying: boolean;
  completedActivities: Map<string, any>;
  failedActivities: Map<string, string>;
  activeTimers: Set<string>;
  signals: Map<string, any[]>;
  isCompleted: boolean;
  result?: any;
  error?: string;
}

/**
 * ReplayDecider reconstructs workflow in-memory state deterministically from an append-only event history,
 * allowing workflow routines to survive worker crashes and server migrations without duplicate executions.
 */
export class ReplayDecider {
  private state: DeciderState;
  private eventHistory: HistoryEvent[] = [];

  constructor(workflowId: string) {
    this.state = {
      workflowId,
      isReplaying: false,
      completedActivities: new Map(),
      failedActivities: new Map(),
      activeTimers: new Set(),
      signals: new Map(),
      isCompleted: false
    };
  }

  public replay(events: HistoryEvent[]): DeciderState {
    this.state.isReplaying = true;
    for (const event of events) {
      this.applyEvent(event);
    }
    this.state.isReplaying = false;
    return this.getState();
  }

  public applyEvent(event: HistoryEvent): void {
    this.eventHistory.push(event);

    switch (event.eventType) {
      case HistoryEventType.ACTIVITY_COMPLETED:
        this.state.completedActivities.set(event.attributes.activityId, event.attributes.result);
        break;

      case HistoryEventType.ACTIVITY_FAILED:
        this.state.failedActivities.set(event.attributes.activityId, event.attributes.error);
        break;

      case HistoryEventType.TIMER_STARTED:
        this.state.activeTimers.add(event.attributes.timerId);
        break;

      case HistoryEventType.TIMER_FIRED:
      case HistoryEventType.TIMER_CANCELLED:
        this.state.activeTimers.delete(event.attributes.timerId);
        break;

      case HistoryEventType.SIGNAL_RECEIVED:
        const signalList = this.state.signals.get(event.attributes.signalName) || [];
        signalList.push(event.attributes.payload);
        this.state.signals.set(event.attributes.signalName, signalList);
        break;

      case HistoryEventType.WORKFLOW_COMPLETED:
        this.state.isCompleted = true;
        this.state.result = event.attributes.result;
        break;

      case HistoryEventType.WORKFLOW_FAILED:
        this.state.isCompleted = true;
        this.state.error = event.attributes.error;
        break;
    }
  }

  public isActivityCompleted(activityId: string): boolean {
    return this.state.completedActivities.has(activityId);
  }

  public getActivityOutput(activityId: string): any {
    return this.state.completedActivities.get(activityId);
  }

  public getState(): DeciderState {
    return {
      ...this.state,
      completedActivities: new Map(this.state.completedActivities),
      failedActivities: new Map(this.state.failedActivities),
      activeTimers: new Set(this.state.activeTimers),
      signals: new Map(this.state.signals)
    };
  }
}
