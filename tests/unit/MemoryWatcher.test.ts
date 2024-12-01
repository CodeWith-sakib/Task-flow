import { MemoryWatcher } from '../../src/observability/profiler/MemoryWatcher';

describe('MemoryWatcher Unit Tests', () => {
  it('should measure heap and rss usage without throwing', () => {
    const watcher = new MemoryWatcher(10000);
    const stats = watcher.getMemoryUsage();
    expect(stats.heapUsedMb).toBeGreaterThan(0);
    expect(watcher.isMemoryThresholdExceeded()).toBe(false);
  });
});
