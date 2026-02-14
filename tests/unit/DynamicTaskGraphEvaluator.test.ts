import { DynamicTaskGraphEvaluator } from '../../src/workflows/DynamicTaskGraphEvaluator';

describe('DynamicTaskGraphEvaluator', () => {
  it('should filter nodes based on execution context conditions', () => {
    const evaluator = new DynamicTaskGraphEvaluator();
    const nodes = [
      { id: 'step-always' },
      { id: 'step-vip', condition: (ctx: any) => ctx.isVip === true }
    ];

    expect(evaluator.evaluateActiveNodes(nodes, { isVip: false })).toEqual(['step-always']);
    expect(evaluator.evaluateActiveNodes(nodes, { isVip: true })).toEqual(['step-always', 'step-vip']);
  });
});
