import { AnomalyDetector } from '../../src/observability/AnomalyDetector';

describe('AnomalyDetector', () => {
  it('should flag values exceeding standard deviation thresholds', () => {
    const baseline = [10, 11, 9, 10, 12, 10];
    expect(AnomalyDetector.isAnomaly(baseline, 11)).toBe(false);
    expect(AnomalyDetector.isAnomaly(baseline, 50)).toBe(true);
  });
});
