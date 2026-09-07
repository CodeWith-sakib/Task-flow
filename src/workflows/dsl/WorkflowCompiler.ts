import { StepDefinition, StepId, WorkflowDefinition } from './types';

export interface CompilationResult {
  valid: boolean;
  errors: string[];
  executionOrder: StepId[];
  parallelBatches: StepId[][];
}

/**
 * WorkflowCompiler validates syntactic and topological structure of workflow DAGs,
 * detects circular dependencies with Tarjan's SCC algorithm, and computes parallel execution batches.
 */
export class WorkflowCompiler {
  public compile(workflow: WorkflowDefinition): CompilationResult {
    const errors: string[] = [];

    if (!workflow.id || !workflow.name || !workflow.steps || workflow.steps.length === 0) {
      return {
        valid: false,
        errors: ['Invalid workflow schema: must include id, name, and at least one step'],
        executionOrder: [],
        parallelBatches: []
      };
    }

    const stepMap = new Map<StepId, StepDefinition>();
    for (const step of workflow.steps) {
      if (stepMap.has(step.id)) {
        errors.push(`Duplicate step ID: '${step.id}'`);
      }
      stepMap.set(step.id, step);
    }

    // Validate dependency references
    for (const step of workflow.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepMap.has(dep)) {
            errors.push(`Step '${step.id}' references non-existent dependency '${dep}'`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors, executionOrder: [], parallelBatches: [] };
    }

    // Check circular dependencies using Tarjan's Strongly Connected Components
    const cycles = this.detectCycles(workflow.steps);
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }
      return { valid: false, errors, executionOrder: [], parallelBatches: [] };
    }

    // Compute topological execution order and parallel batches via Kahn's algorithm
    const { executionOrder, parallelBatches } = this.computeExecutionBatches(workflow.steps);

    return {
      valid: true,
      errors: [],
      executionOrder,
      parallelBatches
    };
  }

  private detectCycles(steps: StepDefinition[]): StepId[][] {
    const adj = new Map<StepId, StepId[]>();
    for (const step of steps) {
      adj.set(step.id, step.dependencies || []);
    }

    let index = 0;
    const indices = new Map<StepId, number>();
    const lowlink = new Map<StepId, number>();
    const onStack = new Set<StepId>();
    const stack: StepId[] = [];
    const sccs: StepId[][] = [];

    const strongConnect = (u: StepId) => {
      indices.set(u, index);
      lowlink.set(u, index);
      index++;
      stack.push(u);
      onStack.add(u);

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        if (!indices.has(v)) {
          strongConnect(v);
          lowlink.set(u, Math.min(lowlink.get(u)!, lowlink.get(v)!));
        } else if (onStack.has(v)) {
          lowlink.set(u, Math.min(lowlink.get(u)!, indices.get(v)!));
        }
      }

      if (lowlink.get(u) === indices.get(u)) {
        const component: StepId[] = [];
        let node: StepId;
        do {
          node = stack.pop()!;
          onStack.delete(node);
          component.push(node);
        } while (node !== u);

        if (component.length > 1) {
          sccs.push(component);
        }
      }
    };

    for (const step of steps) {
      if (!indices.has(step.id)) {
        strongConnect(step.id);
      }
    }

    return sccs;
  }

  private computeExecutionBatches(steps: StepDefinition[]): {
    executionOrder: StepId[];
    parallelBatches: StepId[][];
  } {
    const inDegree = new Map<StepId, number>();
    const dependents = new Map<StepId, StepId[]>();

    for (const step of steps) {
      inDegree.set(step.id, (step.dependencies || []).length);
      dependents.set(step.id, []);
    }

    for (const step of steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          dependents.get(dep)?.push(step.id);
        }
      }
    }

    const executionOrder: StepId[] = [];
    const parallelBatches: StepId[][] = [];
    let readyQueue: StepId[] = [];

    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        readyQueue.push(id);
      }
    }

    while (readyQueue.length > 0) {
      parallelBatches.push([...readyQueue]);
      const nextQueue: StepId[] = [];

      for (const node of readyQueue) {
        executionOrder.push(node);
        for (const dep of dependents.get(node) || []) {
          const newDeg = inDegree.get(dep)! - 1;
          inDegree.set(dep, newDeg);
          if (newDeg === 0) {
            nextQueue.push(dep);
          }
        }
      }

      readyQueue = nextQueue;
    }

    return { executionOrder, parallelBatches };
  }
}
