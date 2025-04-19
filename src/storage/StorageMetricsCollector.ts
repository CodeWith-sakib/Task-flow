export class StorageMetricsCollector {
  private readCount = 0;
  private writeCount = 0;
  private totalReadLatencyMs = 0;
  private totalWriteLatencyMs = 0;

  public recordRead(latencyMs: number): void {
    this.readCount++;
    this.totalReadLatencyMs += latencyMs;
  }

  public recordWrite(latencyMs: number): void {
    this.writeCount++;
    this.totalWriteLatencyMs += latencyMs;
  }

  public getMetrics(): {
    reads: number;
    writes: number;
    avgReadLatencyMs: number;
    avgWriteLatencyMs: number;
  } {
    return {
      reads: this.readCount,
      writes: this.writeCount,
      avgReadLatencyMs: this.readCount > 0 ? this.totalReadLatencyMs / this.readCount : 0,
      avgWriteLatencyMs: this.writeCount > 0 ? this.totalWriteLatencyMs / this.writeCount : 0
    };
  }

  public reset(): void {
    this.readCount = 0;
    this.writeCount = 0;
    this.totalReadLatencyMs = 0;
    this.totalWriteLatencyMs = 0;
  }
}
