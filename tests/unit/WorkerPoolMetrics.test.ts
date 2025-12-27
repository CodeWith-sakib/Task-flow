import { WorkerPoolMetrics } from '../../src/concurrency/WorkerPoolMetrics';

describe('WorkerPoolMetrics', () => {
  it('should calculate pool utilization accurately', () => {
    const metrics = new WorkerPoolMetrics(10);
    expect(metrics.getUtilization()).toBe(0);

    metrics.recordTaskStart();
    metrics.recordTaskStart();
    expect(metrics.getUtilization()).toBe(0.2);

    metrics.recordTaskFinish();
    expect(metrics.getUtilization()).toBe(0.1);
    expect(metrics.getCompleted()).toBe(1);
  });
});
