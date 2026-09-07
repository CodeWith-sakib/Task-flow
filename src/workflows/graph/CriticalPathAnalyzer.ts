export interface CPMNode {
  id: string;
  durationMs: number;
  dependencies: string[];
  est: number; // Earliest Start Time
  eft: number; // Earliest Finish Time
  lst: number; // Latest Start Time
  lft: number; // Latest Finish Time
  slack: number; // Float/Slack
  isCritical: boolean;
}

export interface CPMAnalysisResult {
  totalDurationMs: number;
  criticalPath: string[];
  nodes: Record<string, CPMNode>;
}

/**
 * CriticalPathAnalyzer applies the Critical Path Method (CPM) to workflow DAGs
 * identifying the critical bottleneck chain and slack tolerances for parallel branches.
 */
export class CriticalPathAnalyzer {
  public static analyze(
    stepDurations: { id: string; durationMs: number; dependencies?: string[] }[]
  ): CPMAnalysisResult {
    const nodes: Record<string, CPMNode> = {};
    const dependentsMap = new Map<string, string[]>();

    for (const step of stepDurations) {
      nodes[step.id] = {
        id: step.id,
        durationMs: step.durationMs,
        dependencies: step.dependencies || [],
        est: 0,
        eft: 0,
        lst: 0,
        lft: 0,
        slack: 0,
        isCritical: false
      };
      dependentsMap.set(step.id, []);
    }

    for (const step of stepDurations) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          dependentsMap.get(dep)?.push(step.id);
        }
      }
    }

    // 1. Forward pass (EST and EFT)
    const inDegree = new Map<string, number>();
    for (const step of stepDurations) {
      inDegree.set(step.id, (step.dependencies || []).length);
    }

    const forwardQueue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        forwardQueue.push(id);
        nodes[id].est = 0;
        nodes[id].eft = nodes[id].durationMs;
      }
    }

    const topoOrder: string[] = [];
    while (forwardQueue.length > 0) {
      const u = forwardQueue.shift()!;
      topoOrder.push(u);

      for (const v of dependentsMap.get(u) || []) {
        nodes[v].est = Math.max(nodes[v].est, nodes[u].eft);
        nodes[v].eft = nodes[v].est + nodes[v].durationMs;

        const newDeg = inDegree.get(v)! - 1;
        inDegree.set(v, newDeg);
        if (newDeg === 0) {
          forwardQueue.push(v);
        }
      }
    }

    const totalDurationMs = Object.values(nodes).reduce((max, n) => Math.max(max, n.eft), 0);

    // 2. Backward pass (LFT and LST)
    for (const id of Object.keys(nodes)) {
      nodes[id].lft = totalDurationMs;
      nodes[id].lst = totalDurationMs - nodes[id].durationMs;
    }

    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const u = topoOrder[i];
      const deps = dependentsMap.get(u) || [];

      if (deps.length > 0) {
        let minLst = Number.MAX_SAFE_INTEGER;
        for (const dep of deps) {
          minLst = Math.min(minLst, nodes[dep].lst);
        }
        nodes[u].lft = minLst;
        nodes[u].lst = nodes[u].lft - nodes[u].durationMs;
      }

      nodes[u].slack = nodes[u].lst - nodes[u].est;
      nodes[u].isCritical = nodes[u].slack === 0;
    }

    const criticalPath = topoOrder.filter(id => nodes[id].isCritical);

    return {
      totalDurationMs,
      criticalPath,
      nodes
    };
  }
}
