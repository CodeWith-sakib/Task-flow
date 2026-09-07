export interface GraphNode {
  id: string;
  condition?: (ctx: Record<string, any>) => boolean;
  dependencies?: string[];
}

/**
 * DAGPruningOptimizer prunes dead, unreachable, or condition-falsified branches from workflow execution DAGs.
 */
export class DAGPruningOptimizer {
  public static prune(nodes: GraphNode[], runtimeContext: Record<string, any>): {
    activeNodeIds: string[];
    prunedNodeIds: string[];
  } {
    const nodeMap = new Map<string, GraphNode>();
    const dependents = new Map<string, string[]>();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
      dependents.set(node.id, []);
    }

    for (const node of nodes) {
      if (node.dependencies) {
        for (const dep of node.dependencies) {
          dependents.get(dep)?.push(node.id);
        }
      }
    }

    const pruned = new Set<string>();
    const active = new Set<string>();

    for (const node of nodes) {
      if (pruned.has(node.id)) continue;

      if (node.condition && !node.condition(runtimeContext)) {
        this.markPrunedCascade(node.id, dependents, pruned);
      } else {
        // Check if all dependencies are active
        const allDepsActive = (node.dependencies || []).every(dep => !pruned.has(dep));
        if (allDepsActive) {
          active.add(node.id);
        } else {
          this.markPrunedCascade(node.id, dependents, pruned);
        }
      }
    }

    for (const node of nodes) {
      if (!pruned.has(node.id)) {
        active.add(node.id);
      }
    }

    return {
      activeNodeIds: Array.from(active),
      prunedNodeIds: Array.from(pruned)
    };
  }

  private static markPrunedCascade(
    startNodeId: string,
    dependents: Map<string, string[]>,
    prunedSet: Set<string>
  ): void {
    const queue = [startNodeId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (!prunedSet.has(curr)) {
        prunedSet.add(curr);
        for (const child of dependents.get(curr) || []) {
          queue.push(child);
        }
      }
    }
  }
}
