import { JitteredIntervalScheduler } from '../../src/scheduler/JitteredIntervalScheduler';

describe('JitteredIntervalScheduler', () => {
  it('should compute delay within base and jitter range', () => {
    const scheduler = new JitteredIntervalScheduler(1000, 200);
    for (let i = 0; i < 20; i++) {
      const delay = scheduler.computeNextDelay();
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1200);
    }
  });
});
