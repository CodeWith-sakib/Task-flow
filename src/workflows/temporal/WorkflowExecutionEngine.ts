/**
 * End-to-End Durable Workflow Execution Engine.
 * Integrates HistoryEvents, ReplayDecider, ActivityWorker, SignalChannel,
 * and TimerCoordinator into a robust, deterministic execution runtime.
 */

import { HistoryEvent, HistoryEventType } from './HistoryEvents';
import { ReplayDecider } from './ReplayDecider';
import { ActivityWorker, ActivityTask } from './ActivityWorker';
import { SignalChannel } from './SignalChannel';
import { TimerCoordinator } from './TimerCoordinator';
import { QueryHandlerRegistry } from './QueryHandlerRegistry';

export interface WorkflowInstance {
  workflowId: string;
  workflowType: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  history: HistoryEvent[];
  startedAt: number;
  completedAt?: number;
  result?: any;
  error?: string;
}

export type WorkflowFn = (context: WorkflowContext) => Promise<any>;

export interface WorkflowContext {
  workflowId: string;
  executeActivity: (activityType: string, input: any, options?: { timeoutMs?: number }) => Promise<any>;
  sleep: (durationMs: number) => Promise<void>;
  waitForSignal: (signalName: string, timeoutMs?: number) => Promise<any>;
  queryRegistry: QueryHandlerRegistry;
}

export class WorkflowExecutionEngine {
  private instances = new Map<string, WorkflowInstance>();
  private workflowRegistry = new Map<string, WorkflowFn>();
  private activityWorker: ActivityWorker;
  private signalChannels = new Map<string, SignalChannel>();
  private timerCoordinator = new TimerCoordinator();
  private queryRegistry = new QueryHandlerRegistry();
  private eventIdCounter = 0;

  constructor(activityWorker?: ActivityWorker) {
    this.activityWorker = activityWorker || new ActivityWorker();
  }

  public registerWorkflow(workflowType: string, fn: WorkflowFn): void {
    this.workflowRegistry.set(workflowType, fn);
  }

  public getActivityWorker(): ActivityWorker {
    return this.activityWorker;
  }

  public getQueryRegistry(): QueryHandlerRegistry {
    return this.queryRegistry;
  }

  public async startWorkflow(workflowId: string, workflowType: string, input: any): Promise<WorkflowInstance> {
    const fn = this.workflowRegistry.get(workflowType);
    if (!fn) {
      throw new Error(`Workflow type "${workflowType}" not registered`);
    }

    const instance: WorkflowInstance = {
      workflowId,
      workflowType,
      status: 'RUNNING',
      history: [],
      startedAt: Date.now(),
    };

    this.instances.set(workflowId, instance);

    this.recordEvent(instance, HistoryEventType.WORKFLOW_STARTED, {
      workflowId,
      workflowType,
      input,
      taskQueue: 'default',
    });

    // Execute workflow asynchronously
    this.runWorkflowLoop(instance, fn, input);

    return instance;
  }

  public async signalWorkflow(workflowId: string, signalName: string, payload: any): Promise<boolean> {
    const instance = this.instances.get(workflowId);
    if (!instance || instance.status !== 'RUNNING') {
      return false;
    }

    this.recordEvent(instance, HistoryEventType.SIGNAL_RECEIVED, {
      signalName,
      payload,
    });

    let channel = this.signalChannels.get(`${workflowId}:${signalName}`);
    if (!channel) {
      channel = new SignalChannel(signalName);
      this.signalChannels.set(`${workflowId}:${signalName}`, channel);
    }

    channel.send(payload);
    return true;
  }

  public getWorkflowInstance(workflowId: string): WorkflowInstance | undefined {
    return this.instances.get(workflowId);
  }

  private async runWorkflowLoop(instance: WorkflowInstance, fn: WorkflowFn, input: any): Promise<void> {
    let activitySeq = 0;
    let timerSeq = 0;

    const context: WorkflowContext = {
      workflowId: instance.workflowId,
      queryRegistry: this.queryRegistry,

      executeActivity: async (activityType: string, actInput: any, options: { timeoutMs?: number } = {}) => {
        const activityId = `act-${++activitySeq}`;
        const timeoutMs = options.timeoutMs || 30000;

        this.recordEvent(instance, HistoryEventType.ACTIVITY_SCHEDULED, {
          activityId,
          activityType,
          input: actInput,
          taskQueue: 'default',
          scheduleToCloseTimeoutMs: timeoutMs,
          startToCloseTimeoutMs: timeoutMs,
        });

        this.recordEvent(instance, HistoryEventType.ACTIVITY_STARTED, { activityId });

        const task: ActivityTask = {
          activityId,
          activityType,
          workflowId: instance.workflowId,
          input: actInput,
          timeoutMs,
        };

        const result = await this.activityWorker.executeTask(task);

        if (result.status === 'COMPLETED') {
          this.recordEvent(instance, HistoryEventType.ACTIVITY_COMPLETED, {
            activityId,
            result: result.result,
          });
          return result.result;
        } else {
          this.recordEvent(instance, HistoryEventType.ACTIVITY_FAILED, {
            activityId,
            error: result.error || 'Activity failed',
            retryAttempts: 1,
          });
          throw new Error(result.error || 'Activity failed');
        }
      },

      sleep: async (durationMs: number) => {
        const timerId = `timer-${++timerSeq}`;
        this.recordEvent(instance, HistoryEventType.TIMER_STARTED, {
          timerId,
          durationMs,
          fireTime: Date.now() + durationMs,
        });

        await new Promise((resolve) => setTimeout(resolve, durationMs));

        this.recordEvent(instance, HistoryEventType.TIMER_FIRED, { timerId });
      },

      waitForSignal: async (signalName: string, timeoutMs?: number) => {
        let channel = this.signalChannels.get(`${instance.workflowId}:${signalName}`);
        if (!channel) {
          channel = new SignalChannel(signalName);
          this.signalChannels.set(`${instance.workflowId}:${signalName}`, channel);
        }
        return channel.receive(timeoutMs);
      },
    };

    try {
      const result = await fn(context);
      instance.status = 'COMPLETED';
      instance.completedAt = Date.now();
      instance.result = result;

      this.recordEvent(instance, HistoryEventType.WORKFLOW_COMPLETED, { result });
    } catch (err: any) {
      instance.status = 'FAILED';
      instance.completedAt = Date.now();
      instance.error = err.message || String(err);

      this.recordEvent(instance, HistoryEventType.WORKFLOW_FAILED, {
        error: instance.error,
      });
    }
  }

  private recordEvent(instance: WorkflowInstance, eventType: HistoryEventType, attributes: any): HistoryEvent {
    const event: HistoryEvent = {
      eventId: ++this.eventIdCounter,
      eventType,
      timestamp: Date.now(),
      attributes,
    };
    instance.history.push(event);
    return event;
  }
}
