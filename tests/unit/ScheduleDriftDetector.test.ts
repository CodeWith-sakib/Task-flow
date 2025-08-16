import { ScheduleDriftDetector } from '../../src/scheduler/ScheduleDriftDetector';

describe('ScheduleDriftDetector', () => {
  it('should detect when execution drifts beyond tolerable thresholds', () => {
    const detector = new ScheduleDriftDetector(500);
    expect(detector.checkDrift(1000, 1200).hasExcessiveDrift).toBe(false);
    expect(detector.checkDrift(1000, 1600).hasExcessiveDrift).toBe(true);
  });
});
