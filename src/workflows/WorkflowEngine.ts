import { v4 as uuidv4 } from 'uuid';
import { TaskStatus } from '../types';
import { TaskService } from '../core/TaskService';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStatus,
  WorkflowStep,
  StepExecutionState,
} from './types';
import { DAGValidator } from './dag/DAGValidator';

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private taskToExecutionMap: Map<string, { executionId: string; stepId: string }> = new Map();

  constructor(private taskService: TaskService) {}

  registerWorkflow(definition: WorkflowDefinition): void {
    const validation = DAGValidator.validate(definition);
    if (!validation.valid) {
      throw new Error(`Invalid workflow DAG: ${validation.errors.join(', ')}`);
    }
    this.workflows.set(definition.id, definition);
  }

  getWorkflow(id: string): WorkflowDefinition | null {
    return this.workflows.get(id) ?? null;
  }

  getExecution(executionId: string): WorkflowExecution | null {
    return this.executions.get(executionId) ?? null;
  }

  async startWorkflow(
    workflowId: string,
    initialContext: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not registered`);
    }

    const executionId = `wf_exec_${uuidv4()}`;
    const stepStates = new Map<string, StepExecutionState>();

    for (const step of workflow.steps) {
      stepStates.set(step.id, {
        stepId: step.id,
        status: TaskStatus.PENDING,
      });
    }

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: WorkflowStatus.RUNNING,
      stepStates,
      context: { ...initialContext },
      startedAt: new Date(),
    };

    this.executions.set(executionId, execution);

    // Trigger initial ready steps (steps with 0 dependencies)
    await this.triggerReadySteps(execution, workflow);

    return execution;
  }

  private async triggerReadySteps(
    execution: WorkflowExecution,
    workflow: WorkflowDefinition
  ): Promise<void> {
    for (const step of workflow.steps) {
      const state = execution.stepStates.get(step.id);
      if (state && state.status === TaskStatus.PENDING) {
        const canRun = this.areDependenciesSatisfied(step, execution);
        if (canRun) {
          // Check condition if present
          if (step.when && !step.when(execution.context)) {
            state.status = TaskStatus.SUCCESS; // Mark as skipped/satisfied
            state.completedAt = new Date();
            continue;
          }

          await this.dispatchStepTask(step, execution);
        }
      }
    }
  }

  private areDependenciesSatisfied(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): boolean {
    const deps = step.dependsOn || [];
    for (const depId of deps) {
      const depState = execution.stepStates.get(depId);
      if (!depState || depState.status !== TaskStatus.SUCCESS) {
        return false;
      }
    }
    return true;
  }

  private async dispatchStepTask(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    const state = execution.stepStates.get(step.id)!;
    state.status = TaskStatus.QUEUED;
    state.startedAt = new Date();

    const payload = typeof step.payload === 'function'
      ? step.payload(execution.context)
      : (step.payload || {});

    const task = await this.taskService.createTask({
      type: step.taskType,
      payload: {
        ...payload,
        __workflow: {
          executionId: execution.id,
          stepId: step.id,
        },
      },
      priority: step.priority ?? 0,
      maxRetries: step.maxRetries ?? 2,
    });

    state.taskId = task.id;
    this.taskToExecutionMap.set(task.id, {
      executionId: execution.id,
      stepId: step.id,
    });
  }

  async handleTaskCompletion(taskId: string, output: any): Promise<void> {
    const mapping = this.taskToExecutionMap.get(taskId);
    if (!mapping) return;

    const { executionId, stepId } = mapping;
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== WorkflowStatus.RUNNING) return;

    const stepState = execution.stepStates.get(stepId);
    if (stepState) {
      stepState.status = TaskStatus.SUCCESS;
      stepState.output = output;
      stepState.completedAt = new Date();
      execution.context[stepId] = output;
    }

    const workflow = this.workflows.get(execution.workflowId)!;

    // Check if entire workflow completed
    const allCompleted = Array.from(execution.stepStates.values()).every(
      s => s.status === TaskStatus.SUCCESS
    );

    if (allCompleted) {
      execution.status = WorkflowStatus.COMPLETED;
      execution.completedAt = new Date();
      return;
    }

    // Trigger newly ready steps
    await this.triggerReadySteps(execution, workflow);
  }

  async handleTaskFailure(taskId: string, error: string): Promise<void> {
    const mapping = this.taskToExecutionMap.get(taskId);
    if (!mapping) return;

    const { executionId, stepId } = mapping;
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== WorkflowStatus.RUNNING) return;

    const stepState = execution.stepStates.get(stepId);
    if (stepState) {
      stepState.status = TaskStatus.FAILED;
      stepState.error = error;
      stepState.completedAt = new Date();
    }

    execution.status = WorkflowStatus.FAILED;
    execution.error = `Step '${stepId}' failed: ${error}`;
    execution.completedAt = new Date();

    // Trigger compensation for previously completed steps in reverse (Saga)
    await this.triggerCompensations(execution);
  }

  private async triggerCompensations(execution: WorkflowExecution): Promise<void> {
    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) return;

    for (let i = workflow.steps.length - 1; i >= 0; i--) {
      const step = workflow.steps[i];
      const state = execution.stepStates.get(step.id);
      if (state && state.status === TaskStatus.SUCCESS && step.compensationType) {
        await this.taskService.createTask({
          type: step.compensationType,
          payload: {
            stepId: step.id,
            originalOutput: state.output,
            workflowExecutionId: execution.id,
          },
        });
      }
    }
  }

  async cancelWorkflow(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== WorkflowStatus.RUNNING) {
      return false;
    }
    execution.status = WorkflowStatus.CANCELLED;
    execution.completedAt = new Date();
    return true;
  }
}
