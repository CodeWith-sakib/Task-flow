/**
 * Temporal event history definitions for durable deterministic workflow execution.
 */

export enum HistoryEventType {
  WORKFLOW_STARTED = 'WORKFLOW_STARTED',
  WORKFLOW_COMPLETED = 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  WORKFLOW_CANCELLED = 'WORKFLOW_CANCELLED',
  ACTIVITY_SCHEDULED = 'ACTIVITY_SCHEDULED',
  ACTIVITY_STARTED = 'ACTIVITY_STARTED',
  ACTIVITY_COMPLETED = 'ACTIVITY_COMPLETED',
  ACTIVITY_FAILED = 'ACTIVITY_FAILED',
  ACTIVITY_CANCELLED = 'ACTIVITY_CANCELLED',
  TIMER_STARTED = 'TIMER_STARTED',
  TIMER_FIRED = 'TIMER_FIRED',
  TIMER_CANCELLED = 'TIMER_CANCELLED',
  SIGNAL_RECEIVED = 'SIGNAL_RECEIVED',
  MARKER_RECORDED = 'MARKER_RECORDED',
  CHILD_WORKFLOW_INITIATED = 'CHILD_WORKFLOW_INITIATED',
  CHILD_WORKFLOW_COMPLETED = 'CHILD_WORKFLOW_COMPLETED'
}

export interface HistoryEvent<T = any> {
  eventId: number;
  eventType: HistoryEventType;
  timestamp: number;
  attributes: T;
}

export interface WorkflowStartedAttributes {
  workflowId: string;
  workflowType: string;
  input: any;
  executionTimeoutMs?: number;
  taskQueue: string;
}

export interface ActivityScheduledAttributes {
  activityId: string;
  activityType: string;
  input: any;
  taskQueue: string;
  scheduleToCloseTimeoutMs: number;
  startToCloseTimeoutMs: number;
  heartbeatTimeoutMs?: number;
}

export interface ActivityCompletedAttributes {
  activityId: string;
  result: any;
}

export interface ActivityFailedAttributes {
  activityId: string;
  error: string;
  retryAttempts: number;
}

export interface TimerStartedAttributes {
  timerId: string;
  durationMs: number;
  fireTime: number;
}

export interface SignalReceivedAttributes {
  signalName: string;
  payload: any;
}
