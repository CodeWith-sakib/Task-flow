/**
 * Worker Node Heartbeat & Zombie Reaper Coordinator.
 * Receives periodic heartbeat payloads with node capacity & active task counts,
 * detecting unresponsive zombie worker nodes and triggering task re-queuing.
 */

export interface WorkerHeartbeatPayload {
  workerId: string;
  hostname: string;
  activeTasks: string[];
  maxCapacity: number;
  cpuUsagePct: number;
  freeMemoryBytes: number;
  timestamp: number;
}

export interface WorkerNodeStatus {
  workerId: string;
  hostname: string;
  lastHeartbeat: WorkerHeartbeatPayload;
  status: 'ONLINE' | 'SUSPECT' | 'DEAD';
  lastSeenTs: number;
}

export class WorkerHeartbeatCoordinator {
  private workers = new Map<string, WorkerNodeStatus>();
  private heartbeatTimeoutMs: number;
  private deadTimeoutMs: number;

  constructor(heartbeatTimeoutMs: number = 6000, deadTimeoutMs: number = 15000) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
    this.deadTimeoutMs = deadTimeoutMs;
  }

  public recordHeartbeat(payload: WorkerHeartbeatPayload, now: number = Date.now()): void {
    const existing = this.workers.get(payload.workerId);
    if (!existing) {
      this.workers.set(payload.workerId, {
        workerId: payload.workerId,
        hostname: payload.hostname,
        lastHeartbeat: payload,
        status: 'ONLINE',
        lastSeenTs: now,
      });
    } else {
      existing.lastHeartbeat = payload;
      existing.lastSeenTs = now;
      existing.status = 'ONLINE';
    }
  }

  public reapZombies(now: number = Date.now()): { suspectWorkerIds: string[]; deadWorkerIds: string[]; orphanedTaskIds: string[] } {
    const suspectWorkerIds: string[] = [];
    const deadWorkerIds: string[] = [];
    const orphanedTaskIds: string[] = [];

    for (const [workerId, node] of this.workers.entries()) {
      const elapsed = now - node.lastSeenTs;

      if (elapsed > this.deadTimeoutMs) {
        node.status = 'DEAD';
        deadWorkerIds.push(workerId);
        orphanedTaskIds.push(...node.lastHeartbeat.activeTasks);
      } else if (elapsed > this.heartbeatTimeoutMs) {
        node.status = 'SUSPECT';
        suspectWorkerIds.push(workerId);
      }
    }

    return {
      suspectWorkerIds,
      deadWorkerIds,
      orphanedTaskIds,
    };
  }

  public getOnlineWorkers(): WorkerNodeStatus[] {
    return Array.from(this.workers.values()).filter((w) => w.status === 'ONLINE');
  }

  public getWorker(workerId: string): WorkerNodeStatus | undefined {
    return this.workers.get(workerId);
  }
}
