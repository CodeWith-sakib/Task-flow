import { StepActionType, StepId, WorkflowContext, WorkflowDefinition } from '../dsl/types';
import { WorkflowCompiler } from '../dsl/WorkflowCompiler';
import { CELInterpreter } from '../dsl/CELInterpreter';

export enum WorkflowInstanceStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED'
}

export interface WorkflowInstance {
  instanceId: string;
  workflowId: string;
  status: WorkflowInstanceStatus;
  context: WorkflowContext;
  executedSteps: Set<StepId>;
  failedSteps: Set<StepId>;
  skippedSteps: Set<StepId>;
  startTime: number;
  endTime?: number;
  error?: string;
}

export type StepHandler = (step: any, context: WorkflowContext) => Promise<any>;

/**
 * WorkflowExecutionRuntime coordinates workflow instance lifecycles, runs topological
 * parallel batches, evaluates dynamic branch guards, and produces deterministic outputs.
 */
export class WorkflowExecutionRuntime {
  private compiler: WorkflowCompiler;
  private interpreter: CELInterpreter;
  private stepHandlers: Map<string, StepHandler> = new Map();
  private instances: Map<string, WorkflowInstance> = new Map();

  constructor() {
    this.compiler = new WorkflowCompiler();
    this.interpreter = new CELInterpreter();
    this.registerDefaultHandlers();
  }

  public registerStepHandler(action: string, handler: StepHandler): void {
    this.stepHandlers.set(action, handler);
  }

  public async executeWorkflow(
    definition: WorkflowDefinition,
    input: Record<string, any> = {},
    instanceId: string = `wf-inst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  ): Promise<WorkflowInstance> {
    const compilation = this.compiler.compile(definition);
    if (!compilation.valid) {
      throw new Error(`Workflow compilation failed: ${compilation.errors.join(', ')}`);
    }

    const context: WorkflowContext = {
      workflowId: definition.id,
      instanceId,
      input,
      stepOutputs: {},
      variables: {},
      startTime: Date.now()
    };

    const instance: WorkflowInstance = {
      instanceId,
      workflowId: definition.id,
      status: WorkflowInstanceStatus.RUNNING,
      context,
      executedSteps: new Set(),
      failedSteps: new Set(),
      skippedSteps: new Set(),
      startTime: Date.now()
    };

    this.instances.set(instanceId, instance);
    const stepMap = new Map(definition.steps.map(s => [s.id, s]));

    try {
      for (const batch of compilation.parallelBatches) {
        const executableInBatch = batch.filter(stepId => {
          const step = stepMap.get(stepId)!;
          // Check if dependencies were successful
          const deps = step.dependencies || [];
          const depsSuccessful = deps.every(d => instance.executedSteps.has(d) && !instance.failedSteps.has(d));
          if (!depsSuccessful) {
            instance.skippedSteps.add(stepId);
            return false;
          }

          // Evaluate conditional guard if present
          if (step.condition) {
            const conditionPassed = this.interpreter.evaluatePredicate(step.condition, instance.context);
            if (!conditionPassed) {
              instance.skippedSteps.add(stepId);
              return false;
            }
          }

          return true;
        });

        // Execute batch in parallel
        await Promise.all(
          executableInBatch.map(async stepId => {
            const step = stepMap.get(stepId)!;
            try {
              const output = await this.executeStep(step, instance.context);
              instance.context.stepOutputs[stepId] = output;
              instance.executedSteps.add(stepId);
            } catch (err: any) {
              instance.failedSteps.add(stepId);
              throw new Error(`Step '${stepId}' failed: ${err.message || String(err)}`);
            }
          })
        );
      }

      instance.status = WorkflowInstanceStatus.COMPLETED;
      instance.endTime = Date.now();
    } catch (err: any) {
      instance.status = WorkflowInstanceStatus.FAILED;
      instance.error = err.message || String(err);
      instance.endTime = Date.now();
    }

    return instance;
  }

  public getInstance(instanceId: string): WorkflowInstance | undefined {
    return this.instances.get(instanceId);
  }

  private async executeStep(step: any, context: WorkflowContext): Promise<any> {
    if (step.type === StepActionType.PASS) {
      return step.parameters || {};
    }

    if (step.type === StepActionType.FAIL) {
      throw new Error(step.parameters?.message || 'Explicit FAIL step triggered');
    }

    const handler = this.stepHandlers.get(step.action || step.type);
    if (!handler) {
      // Default execution fallback
      return { status: 'success', stepId: step.id, timestamp: Date.now() };
    }

    return handler(step, context);
  }

  private registerDefaultHandlers(): void {
    this.stepHandlers.set('echo', async (step, ctx) => {
      return {
        result: step.parameters?.message ? this.interpreter.interpolateString(step.parameters.message, ctx) : 'echo'
      };
    });

    this.stepHandlers.set('transform', async (step, ctx) => {
      const output: Record<string, any> = {};
      if (step.parameters?.mapping) {
        for (const [outKey, expr] of Object.entries(step.parameters.mapping)) {
          output[outKey] = this.interpreter.evaluateExpression(String(expr), ctx);
        }
      }
      return output;
    });
  }
}
