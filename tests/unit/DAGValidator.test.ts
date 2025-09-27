import { DAGValidator } from '../../src/workflows/dag/DAGValidator';
import { WorkflowDefinition } from '../../src/workflows/types';

describe('DAGValidator', () => {
  it('should validate linear DAG workflows and determine topological tiers', () => {
    const wf: WorkflowDefinition = {
      id: 'wf_linear',
      name: 'Linear Pipeline',
      version: 1,
      steps: [
        { id: 'step_1', taskType: 'extract' },
        { id: 'step_2', taskType: 'transform', dependsOn: ['step_1'] },
        { id: 'step_3', taskType: 'load', dependsOn: ['step_2'] },
      ],
    };

    const res = DAGValidator.validate(wf);
    expect(res.valid).toBe(true);
    expect(res.topologicalOrder).toEqual(['step_1', 'step_2', 'step_3']);
    expect(res.executionTiers).toEqual([['step_1'], ['step_2'], ['step_3']]);
  });

  it('should correctly construct parallel tiers for fan-out / fan-in DAGs', () => {
    const wf: WorkflowDefinition = {
      id: 'wf_fanout',
      name: 'Fanout Pipeline',
      version: 1,
      steps: [
        { id: 'start', taskType: 'init' },
        { id: 'branch_a', taskType: 'compute_a', dependsOn: ['start'] },
        { id: 'branch_b', taskType: 'compute_b', dependsOn: ['start'] },
        { id: 'merge', taskType: 'aggregate', dependsOn: ['branch_a', 'branch_b'] },
      ],
    };

    const res = DAGValidator.validate(wf);
    expect(res.valid).toBe(true);
    expect(res.executionTiers[0]).toEqual(['start']);
    expect(res.executionTiers[1].sort()).toEqual(['branch_a', 'branch_b'].sort());
    expect(res.executionTiers[2]).toEqual(['merge']);
  });

  it('should detect circular dependency cycles and report an error', () => {
    const wf: WorkflowDefinition = {
      id: 'wf_cycle',
      name: 'Cyclic Pipeline',
      version: 1,
      steps: [
        { id: 'a', taskType: 't', dependsOn: ['c'] },
        { id: 'b', taskType: 't', dependsOn: ['a'] },
        { id: 'c', taskType: 't', dependsOn: ['b'] },
      ],
    };

    const res = DAGValidator.validate(wf);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('cycle'))).toBe(true);
  });

  it('should reject dependencies pointing to non-existent step IDs', () => {
    const wf: WorkflowDefinition = {
      id: 'wf_missing_dep',
      name: 'Invalid Dep',
      version: 1,
      steps: [
        { id: 'step_1', taskType: 't', dependsOn: ['non_existent'] },
      ],
    };

    const res = DAGValidator.validate(wf);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("depends on non-existent step 'non_existent'");
  });

  it('should reject duplicate step IDs', () => {
    const wf: WorkflowDefinition = {
      id: 'wf_dup',
      name: 'Duplicate Step ID',
      version: 1,
      steps: [
        { id: 'step_1', taskType: 't1' },
        { id: 'step_1', taskType: 't2' },
      ],
    };

    const res = DAGValidator.validate(wf);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("Duplicate step ID detected: 'step_1'");
  });
});
