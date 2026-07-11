import { SamplingTraceFilter } from '../../src/observability/SamplingTraceFilter';

describe('SamplingTraceFilter', () => {
  it('should unconditionally sample errors', () => {
    const filter = new SamplingTraceFilter(0);
    expect(filter.shouldSample(true)).toBe(true);
    expect(filter.shouldSample(false)).toBe(false);
  });
});
