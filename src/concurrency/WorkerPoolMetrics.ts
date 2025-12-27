export class WorkerPoolMetrics {
  private activeWorkers = 0;
  private totalCapacity = 0;
  private completedTasks = 0;

  constructor(totalCapacity: number) {
    this.totalCapacity = totalCapacity;
  }

  public recordTaskStart(): void {
    this.activeWorkers++;
  }

  public recordTaskFinish(): void {
    if (this.activeWorkers > 0) this.activeWorkers--;
    this.completedTasks++;
  }

  public getUtilization(): number {
    return this.totalCapacity > 0 ? this.activeWorkers / this.totalCapacity : 0;
  }

  public getCompleted(): number {
    return this.completedTasks;
  }
}
