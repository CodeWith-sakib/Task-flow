import { DAGValidator } from '../../src/workflows/dag/DAGValidator';
import { WorkflowStateCheckpoint } from '../../src/workflows/WorkflowStateCheckpoint';
import { WorkflowDefinition } from '../../src/workflows/types';

describe('Workflow REST & RPC Endpoints API Tests', () => {
  it('should validate workflow definitions via API endpoint', () => {
    const validWorkflow: WorkflowDefinition = {
      id: 'wf-api-test',
      name: 'DataProcessingPipeline',
      version: 1,
      steps: [
        { id: 'extract', taskType: 'db_extract', dependsOn: [] },
        { id: 'transform', taskType: 'spark_job', dependsOn: ['extract'] },
        { id: 'load', taskType: 'db_load', dependsOn: ['transform'] },
      ],
    };

    const validation = DAGValidator.validate(validWorkflow);
    expect(validation.valid).toBe(true);
    expect(validation.topologicalOrder).toEqual(['extract', 'transform', 'load']);
    expect(validation.executionTiers.length).toBe(3);
  });

  it('should reject cyclic workflow graph definitions with 400 bad request error structure', () => {
    const cyclicWorkflow: WorkflowDefinition = {
      id: 'wf-cyclic',
      name: 'CyclicWorkflow',
      version: 1,
      steps: [
        { id: 'a', taskType: 'noop', dependsOn: ['b'] },
        { id: 'b', taskType: 'noop', dependsOn: ['a'] },
      ],
    };

    const validation = DAGValidator.validate(cyclicWorkflow);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.toLowerCase().includes('cycle'))).toBe(true);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should retrieve workflow execution checkpoints via API query', () => {
    const checkpointer = new WorkflowStateCheckpoint();
    checkpointer.saveCheckpoint('wf-run-550', 'transform', { processedRecords: 15000 });

    const checkpoint = checkpointer.getCheckpoint('wf-run-550');
    expect(checkpoint).toBeDefined();
    expect(checkpoint?.workflowId).toBe('wf-run-550');
    expect(checkpoint?.lastCompletedStep).toBe('transform');
    expect(checkpoint?.stepOutputs.processedRecords).toBe(15000);
  });
});
