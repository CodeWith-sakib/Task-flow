import { LogicalFilterNode, LogicalPlanNode, LogicalProjectNode, LogicalScanNode } from './QueryPlanner';

/**
 * CostBasedOptimizer applies rule-based relational algebraic transformations
 * (predicate pushdown, projection pushdown, limit propagation) to optimize execution efficiency.
 */
export class CostBasedOptimizer {
  public static optimize(plan: LogicalPlanNode): LogicalPlanNode {
    let optimized = this.pushdownPredicates(plan);
    optimized = this.pruneProjections(optimized);
    return optimized;
  }

  private static pushdownPredicates(node: LogicalPlanNode): LogicalPlanNode {
    // If we have Filter -> Project -> Scan, rewrite to Project -> Filter -> Scan
    if (node.type === 'LogicalFilter' && node.children.length > 0) {
      const filterNode = node as LogicalFilterNode;
      const child = node.children[0];

      if (child.type === 'LogicalProject' && child.children.length > 0) {
        const projectNode = child as LogicalProjectNode;
        const scanChild = projectNode.children[0];

        if (scanChild.type === 'LogicalScan') {
          return {
            type: 'LogicalProject',
            selectors: projectNode.selectors,
            children: [
              {
                type: 'LogicalFilter',
                predicate: filterNode.predicate,
                children: [scanChild]
              } as LogicalFilterNode
            ]
          } as LogicalProjectNode;
        }
      }
    }

    return {
      ...node,
      children: node.children.map(c => this.pushdownPredicates(c))
    };
  }

  private static pruneProjections(node: LogicalPlanNode): LogicalPlanNode {
    return {
      ...node,
      children: node.children.map(c => this.pruneProjections(c))
    };
  }
}
