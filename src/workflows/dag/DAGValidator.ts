import { WorkflowDefinition, WorkflowStep } from '../types';

export interface DAGValidationResult {
  valid: boolean;
  errors: string[];
  executionTiers: string[][]; // Steps grouped by parallel execution levels
  topologicalOrder: string[];
}

export class DAGValidator {
  static validate(workflow: WorkflowDefinition): DAGValidationResult {
    const errors: string[] = [];
    const stepMap = new Map<string, WorkflowStep>();
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must contain at least one step');
      return { valid: false, errors, executionTiers: [], topologicalOrder: [] };
    }

    // Step 1: Check unique IDs
    for (const step of workflow.steps) {
      if (stepMap.has(step.id)) {
        errors.push(`Duplicate step ID detected: '${step.id}'`);
      }
      stepMap.set(step.id, step);
      inDegree.set(step.id, 0);
      adjList.set(step.id, []);
    }

    // Step 2: Validate dependencies and build graph
    for (const step of workflow.steps) {
      const deps = step.dependsOn || [];
      for (const depId of deps) {
        if (!stepMap.has(depId)) {
          errors.push(`Step '${step.id}' depends on non-existent step '${depId}'`);
        } else {
          adjList.get(depId)!.push(step.id);
          inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors, executionTiers: [], topologicalOrder: [] };
    }

    // Step 3: Kahn's Algorithm for Topological Sort & Cycle Detection
    const queue: string[] = [];
    for (const [stepId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(stepId);
      }
    }

    const topologicalOrder: string[] = [];
    const executionTiers: string[][] = [];
    let currentTier = [...queue];

    while (currentTier.length > 0) {
      executionTiers.push(currentTier);
      const nextTier: string[] = [];

      for (const stepId of currentTier) {
        topologicalOrder.push(stepId);
        const neighbors = adjList.get(stepId) || [];
        for (const neighbor of neighbors) {
          const updatedDegree = (inDegree.get(neighbor) || 1) - 1;
          inDegree.set(neighbor, updatedDegree);
          if (updatedDegree === 0) {
            nextTier.push(neighbor);
          }
        }
      }
      currentTier = nextTier;
    }

    if (topologicalOrder.length !== workflow.steps.length) {
      errors.push('Circular dependency / cycle detected in workflow DAG definition');
      return { valid: false, errors, executionTiers: [], topologicalOrder: [] };
    }

    return {
      valid: true,
      errors: [],
      executionTiers,
      topologicalOrder,
    };
  }
}
