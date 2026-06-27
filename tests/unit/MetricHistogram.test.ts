import { MetricHistogram } from '../../src/observability/MetricHistogram';

describe('MetricHistogram', () => {
  it('should compute percentiles correctly', () => {
    const hist = new MetricHistogram();
    for (let i = 1; i <= 100; i++) {
      hist.record(i);
    }
    expect(hist.getPercentile(50)).toBe(50);
    expect(hist.getPercentile(90)).toBe(90);
    expect(hist.getPercentile(99)).toBe(99);
  });
});
