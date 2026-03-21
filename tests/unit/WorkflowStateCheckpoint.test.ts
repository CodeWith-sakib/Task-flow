import { WorkflowStateCheckpoint } from '../../src/workflows/WorkflowStateCheckpoint';

describe('WorkflowStateCheckpoint', () => {
  it('should store and restore workflow checkpoints', () => {
    const checkpoint = new WorkflowStateCheckpoint();
    checkpoint.saveCheckpoint('wf-1', 'stepA', { outA: 100 });

    const loaded = checkpoint.getCheckpoint('wf-1');
    expect(loaded?.lastCompletedStep).toBe('stepA');
    expect(loaded?.stepOutputs.outA).toBe(100);
  });
});
