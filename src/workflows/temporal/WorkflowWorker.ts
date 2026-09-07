/**
 * Temporal-Style Workflow Worker.
 * Polls workflow task queues, reconstructs workflow execution state via event replay,
 * executes deterministic workflow definitions, and produces decision commands.
 */

import { HistoryEvent, HistoryEventType } from './HistoryEvents';
import { ReplayDecider } from './ReplayDecider';

export interface WorkflowCommand {
  commandType: 'ScheduleActivity' | 'StartTimer' | 'CompleteWorkflowExecution' | 'FailWorkflowExecution';
  attributes: Record<string, any>;
}

export interface WorkflowTask {
  taskId: string;
  workflowId: string;
  workflowType: string;
  historyEvents: HistoryEvent[];
  attempt: number;
}

export type WorkflowDefinition = (decider: ReplayDecider, input: any) => Promise<any>;

export class WorkflowWorker {
  private workflowDefinitions = new Map<string, WorkflowDefinition>();
  private isRunning = false;
  private taskQueue: WorkflowTask[] = [];

  public registerWorkflow(workflowType: string, definition: WorkflowDefinition): void {
    this.workflowDefinitions.set(workflowType, definition);
  }

  public enqueueTask(task: WorkflowTask): void {
    this.taskQueue.push(task);
  }

  public async processNextTask(): Promise<{ workflowId: string; commands: WorkflowCommand[] } | null> {
    const task = this.taskQueue.shift();
    if (!task) return null;

    const definition = this.workflowDefinitions.get(task.workflowType);
    if (!definition) {
      throw new Error(`Unregistered workflow type: ${task.workflowType}`);
    }

    const decider = new ReplayDecider(task.workflowId);
    decider.replay(task.historyEvents);

    const commands: WorkflowCommand[] = [];

    try {
      // Find WORKFLOW_STARTED event input
      const startedEvent = task.historyEvents.find((e) => e.eventType === HistoryEventType.WORKFLOW_STARTED);
      const input = startedEvent?.attributes?.input;

      // Run workflow deterministically
      const resultPromise = definition(decider, input);

      const result = await Promise.race([
        resultPromise,
        new Promise((resolve) => setTimeout(() => resolve('__YIELD__'), 50)),
      ]);

      if (result !== '__YIELD__') {
        commands.push({
          commandType: 'CompleteWorkflowExecution',
          attributes: { result },
        });
      }
    } catch (err: any) {
      commands.push({
        commandType: 'FailWorkflowExecution',
        attributes: { reason: err.message || String(err) },
      });
    }

    return {
      workflowId: task.workflowId,
      commands,
    };
  }

  public start(): void {
    this.isRunning = true;
  }

  public stop(): void {
    this.isRunning = false;
  }

  public getQueueLength(): number {
    return this.taskQueue.length;
  }
}
