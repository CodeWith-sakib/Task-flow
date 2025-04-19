import { StorageMetricsCollector } from '../../src/storage/StorageMetricsCollector';

describe('StorageMetricsCollector', () => {
  it('should track and aggregate I/O counts and average latencies', () => {
    const collector = new StorageMetricsCollector();
    collector.recordRead(10);
    collector.recordRead(20);
    collector.recordWrite(30);

    const metrics = collector.getMetrics();
    expect(metrics.reads).toBe(2);
    expect(metrics.writes).toBe(1);
    expect(metrics.avgReadLatencyMs).toBe(15);
    expect(metrics.avgWriteLatencyMs).toBe(30);
  });
});
