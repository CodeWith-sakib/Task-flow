export interface Heartbeat {
  workerId: string;
  lastSeenAt: number;
}

export class WorkerHeartbeatMonitor {
  private heartbeats: Map<string, number> = new Map();
  private timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  public recordHeartbeat(workerId: string, timestamp: number = Date.now()): void {
    this.heartbeats.set(workerId, timestamp);
  }

  public getDeadWorkers(now: number = Date.now()): string[] {
    const dead: string[] = [];
    for (const [workerId, lastSeen] of this.heartbeats.entries()) {
      if ((now - lastSeen) > this.timeoutMs) {
        dead.push(workerId);
      }
    }
    return dead;
  }

  public removeWorker(workerId: string): void {
    this.heartbeats.delete(workerId);
  }
}
