import { WorkflowDependencyGraph } from '../../src/workflows/WorkflowDependencyGraph';

describe('WorkflowDependencyGraph', () => {
  it('should compute topological sorting of workflow graph', () => {
    const graph = new WorkflowDependencyGraph();
    graph.addDependency('A', 'B');
    graph.addDependency('B', 'C');
    graph.addDependency('A', 'C');

    const order = graph.getTopologicalOrder();
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'));
  });
});
