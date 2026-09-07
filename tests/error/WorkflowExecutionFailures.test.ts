import { DAGValidator } from '../../src/workflows/dag/DAGValidator';
import { CronParser } from '../../src/scheduler/cron/CronParser';
import { ServiceMeshRouter } from '../../src/clustering/mesh/ServiceMeshRouter';

describe('Workflow Execution Failure Handling Tests', () => {
  it('should reject empty workflow definitions with descriptive error', () => {
    const emptyWorkflow = { id: 'empty-wf', name: 'Empty', version: 1, steps: [] };
    const res = DAGValidator.validate(emptyWorkflow);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('at least one step');
  });

  it('should reject invalid cron expressions with parse error', () => {
    expect(() => CronParser.getNextRun('invalid-cron-string')).toThrow();
  });

  it('should return null when service mesh has no matching route rule or healthy endpoints', () => {
    const mesh = new ServiceMeshRouter();
    expect(mesh.routeRequest('/non-existent/path')).toBeNull();
  });
});
