import { SubworkflowInvoker } from '../../src/workflows/SubworkflowInvoker';

describe('SubworkflowInvoker', () => {
  it('should isolate and propagate context to child subworkflow', () => {
    const parent = { tenantId: 'tenant-1' };
    const child = SubworkflowInvoker.createChildContext(parent, { batchId: 42 });

    expect(child.tenantId).toBe('tenant-1');
    expect(child.batchId).toBe(42);
    expect(child._isSubworkflow).toBe(true);
  });
});
