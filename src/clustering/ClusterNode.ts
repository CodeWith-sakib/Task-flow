export enum NodeStatus {
  JOINING = 'JOINING',
  ACTIVE = 'ACTIVE',
  SUSPECT = 'SUSPECT',
  DRAINING = 'DRAINING',
  DEAD = 'DEAD'
}

export interface NodeMetadata {
  rack?: string;
  zone?: string;
  ip: string;
  port: number;
  tags: Record<string, string>;
  maxConcurrentTasks: number;
}

export interface NodeMetrics {
  cpuUsagePct: number;
  memoryUsageMb: number;
  activeTasks: number;
  queueDepth: number;
  uptimeSec: number;
}

/**
 * ClusterNode represents a distributed peer participant in the TaskFlow-Engine cluster,
 * encapsulating state, health status, capacity metrics, and incarnation sequence counters.
 */
export class ClusterNode {
  public readonly id: string;
  public metadata: NodeMetadata;
  public status: NodeStatus = NodeStatus.JOINING;
  public incarnation: number = 0;
  public lastHeartbeatTime: number = Date.now();
  public metrics: NodeMetrics = {
    cpuUsagePct: 0,
    memoryUsageMb: 0,
    activeTasks: 0,
    queueDepth: 0,
    uptimeSec: 0
  };

  constructor(id: string, metadata: NodeMetadata, initialStatus: NodeStatus = NodeStatus.JOINING) {
    this.id = id;
    this.metadata = metadata;
    this.status = initialStatus;
  }

  public updateHeartbeat(incarnation: number, metrics?: Partial<NodeMetrics>): void {
    if (incarnation >= this.incarnation) {
      this.incarnation = incarnation;
      this.lastHeartbeatTime = Date.now();
      if (this.status === NodeStatus.SUSPECT || this.status === NodeStatus.JOINING) {
        this.status = NodeStatus.ACTIVE;
      }
      if (metrics) {
        this.metrics = { ...this.metrics, ...metrics };
      }
    }
  }

  public markSuspect(): void {
    if (this.status === NodeStatus.ACTIVE) {
      this.status = NodeStatus.SUSPECT;
    }
  }

  public markDead(): void {
    this.status = NodeStatus.DEAD;
  }

  public markDraining(): void {
    this.status = NodeStatus.DRAINING;
  }

  public isAvailableForWork(): boolean {
    return this.status === NodeStatus.ACTIVE && this.metrics.activeTasks < this.metadata.maxConcurrentTasks;
  }

  public getLoadScore(): number {
    const taskUtilization = this.metadata.maxConcurrentTasks > 0
      ? this.metrics.activeTasks / this.metadata.maxConcurrentTasks
      : 1.0;
    const cpuWeight = (this.metrics.cpuUsagePct / 100) * 0.4;
    const taskWeight = taskUtilization * 0.6;
    return cpuWeight + taskWeight;
  }
}
