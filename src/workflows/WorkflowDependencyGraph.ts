export class WorkflowDependencyGraph {
  private adjList: Map<string, string[]> = new Map();

  public addNode(nodeId: string): void {
    if (!this.adjList.has(nodeId)) {
      this.adjList.set(nodeId, []);
    }
  }

  public addDependency(fromNode: string, toNode: string): void {
    this.addNode(fromNode);
    this.addNode(toNode);
    this.adjList.get(fromNode)!.push(toNode);
  }

  public getTopologicalOrder(): string[] {
    const inDegree: Map<string, number> = new Map();
    for (const node of this.adjList.keys()) {
      inDegree.set(node, 0);
    }
    for (const neighbors of this.adjList.values()) {
      for (const n of neighbors) {
        inDegree.set(n, (inDegree.get(n) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [node, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(node);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      order.push(curr);
      for (const neighbor of this.adjList.get(curr) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (order.length !== this.adjList.size) {
      throw new Error('Graph contains a cycle');
    }
    return order;
  }
}
