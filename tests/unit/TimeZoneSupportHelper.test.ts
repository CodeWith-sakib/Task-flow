import { TimeZoneSupportHelper } from '../../src/scheduler/TimeZoneSupportHelper';

describe('TimeZoneSupportHelper', () => {
  it('should identify UTC timezone', () => {
    expect(TimeZoneSupportHelper.isUtc('UTC')).toBe(true);
    expect(TimeZoneSupportHelper.isUtc('America/New_York')).toBe(false);
  });
});
