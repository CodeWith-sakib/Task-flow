import { WorkflowTimeoutPolicy } from '../../src/workflows/WorkflowTimeoutPolicy';

describe('WorkflowTimeoutPolicy', () => {
  it('should resolve if completed before timeout', async () => {
    const res = await WorkflowTimeoutPolicy.withTimeout(Promise.resolve('ok'), 1000);
    expect(res).toBe('ok');
  });

  it('should reject if exceeds timeout', async () => {
    const slow = new Promise(r => setTimeout(r, 200));
    await expect(WorkflowTimeoutPolicy.withTimeout(slow, 50)).rejects.toThrow('Workflow step timed out');
  });
});
