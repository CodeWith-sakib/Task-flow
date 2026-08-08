import { MetricsCollectorPlugin } from '../../src/plugins/MetricsCollectorPlugin';

describe('MetricsCollectorPlugin', () => {
  it('should tally completed and failed tasks', () => {
    const plugin = new MetricsCollectorPlugin();
    plugin.onTaskCompleted();
    plugin.onTaskCompleted();
    plugin.onTaskFailed();

    expect(plugin.completedCount).toBe(2);
    expect(plugin.failedCount).toBe(1);
  });
});
