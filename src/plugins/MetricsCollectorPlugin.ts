export class MetricsCollectorPlugin {
  public completedCount = 0;
  public failedCount = 0;

  public onTaskCompleted(): void {
    this.completedCount++;
  }

  public onTaskFailed(): void {
    this.failedCount++;
  }

  public reset(): void {
    this.completedCount = 0;
    this.failedCount = 0;
  }
}
