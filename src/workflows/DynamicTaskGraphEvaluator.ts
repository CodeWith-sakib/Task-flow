export interface GraphNode {
  id: string;
  condition?: (context: Record<string, unknown>) => boolean;
}

export class DynamicTaskGraphEvaluator {
  public evaluateActiveNodes(nodes: GraphNode[], context: Record<string, unknown>): string[] {
    const active: string[] = [];
    for (const node of nodes) {
      if (!node.condition || node.condition(context)) {
        active.push(node.id);
      }
    }
    return active;
  }
}
