import { WorkflowStateCheckpoint } from '../../src/workflows/WorkflowStateCheckpoint';
import { RecoveryJournal } from '../../src/storage/RecoveryJournal';

describe('Workflow State Checkpoint & Journal Persistence Tests', () => {
  it('should create, serialize, and restore workflow state checkpoints', () => {
    const checkpointer = new WorkflowStateCheckpoint();
    const stepOutputs = { totalAmount: 450, approved: true };

    checkpointer.saveCheckpoint('wf-101', 'step-2', stepOutputs);
    const restored = checkpointer.getCheckpoint('wf-101');

    expect(restored).toBeDefined();
    expect(restored?.workflowId).toBe('wf-101');
    expect(restored?.lastCompletedStep).toBe('step-2');
    expect(restored?.stepOutputs.totalAmount).toBe(450);
  });

  it('should journal recovery entries and filter uncheckpointed operations', () => {
    const journal = new RecoveryJournal();
    const now = Date.now();

    journal.append('tx-1', 'UPDATE', { status: 'RUNNING' });
    journal.append('tx-2', 'DELETE', { target: 'task-992' });

    const entries = journal.getUncheckpointedEntries(now - 1000);
    expect(entries.length).toBe(2);
    expect(entries[0].action).toBe('UPDATE');
    expect(entries[1].action).toBe('DELETE');

    journal.truncateBefore(Date.now() + 5000);
    expect(journal.size()).toBe(0);
  });
});
