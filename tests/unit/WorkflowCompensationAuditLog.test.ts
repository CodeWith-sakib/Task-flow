import { WorkflowCompensationAuditLog } from '../../src/workflows/WorkflowCompensationAuditLog';

describe('WorkflowCompensationAuditLog', () => {
  it('should record and retrieve compensation audit history', () => {
    const audit = new WorkflowCompensationAuditLog();
    audit.logEvent('wf-1', 'chargeCreditCard', 'EXECUTED');
    audit.logEvent('wf-1', 'reserveInventory', 'FAILED');
    audit.logEvent('wf-1', 'chargeCreditCard', 'COMPENSATED');

    const history = audit.getWorkflowHistory('wf-1');
    expect(history.length).toBe(3);
    expect(history[2].action).toBe('COMPENSATED');
  });
});
