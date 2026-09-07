/**
 * Locality-Aware & Affinity Task Dispatcher.
 * Matches incoming workflow tasks with worker nodes based on data locality,
 * memory caching affinity, GPU/hardware capabilities, and current node load.
 */

export interface WorkerNodeDescriptor {
  workerId: string;
  nodeRegion: string;
  cachedDatasetKeys: Set<string>;
  cpuUsagePct: number;
  availableMemoryBytes: number;
  activeTasks: number;
  maxTasks: number;
  tags: string[];
}

export interface DispatchRequirement {
  taskId: string;
  requiredDataKeys: string[];
  preferredRegion?: string;
  requiredTags?: string[];
  minMemoryBytes?: number;
}

export class LocalityAwareTaskDispatcher {
  private workers = new Map<string, WorkerNodeDescriptor>();

  public registerWorker(worker: WorkerNodeDescriptor): void {
    this.workers.set(worker.workerId, worker);
  }

  public unregisterWorker(workerId: string): void {
    this.workers.delete(workerId);
  }

  public selectBestWorker(req: DispatchRequirement): { workerId: string; localityScore: number } | null {
    let bestWorkerId: string | null = null;
    let highestScore = -Infinity;

    for (const worker of this.workers.values()) {
      // 1. Hard constraints check
      if (worker.activeTasks >= worker.maxTasks) continue;
      if (req.minMemoryBytes && worker.availableMemoryBytes < req.minMemoryBytes) continue;
      if (req.requiredTags && !req.requiredTags.every((t) => worker.tags.includes(t))) continue;

      // 2. Compute soft score
      let score = 0;

      // Data locality score (50 points per cached dataset)
      for (const key of req.requiredDataKeys) {
        if (worker.cachedDatasetKeys.has(key)) {
          score += 50;
        }
      }

      // Region affinity (30 points)
      if (req.preferredRegion && worker.nodeRegion === req.preferredRegion) {
        score += 30;
      }

      // CPU load penalty (0 - 30 points)
      score += (100 - worker.cpuUsagePct) * 0.3;

      // Available task capacity bonus (0 - 20 points)
      const capacityRatio = (worker.maxTasks - worker.activeTasks) / worker.maxTasks;
      score += capacityRatio * 20;

      if (score > highestScore) {
        highestScore = score;
        bestWorkerId = worker.workerId;
      }
    }

    if (!bestWorkerId) return null;

    return {
      workerId: bestWorkerId,
      localityScore: highestScore,
    };
  }
}
