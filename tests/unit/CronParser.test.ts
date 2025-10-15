import { CronParser } from '../../src/scheduler/cron/CronParser';

describe('CronParser', () => {
  it('should validate standard 5-field cron syntax', () => {
    expect(CronParser.validate('* * * * *')).toBe(true);
    expect(CronParser.validate('*/5 * * * *')).toBe(true);
    expect(CronParser.validate('0 12 * * 1-5')).toBe(true);
    expect(CronParser.validate('0,30 9-17 * * *')).toBe(true);

    expect(CronParser.validate('invalid cron')).toBe(false);
    expect(CronParser.validate('60 * * * *')).toBe(false); // Minute out of range
    expect(CronParser.validate('* * * 13 *')).toBe(false); // Month out of range
  });

  it('should calculate next run time correctly for simple intervals', () => {
    // Reference date: 2026-09-06 10:15:30
    const baseDate = new Date('2026-09-06T10:15:30Z');

    // Next run for '*/5 * * * *' (every 5th minute) should be 10:20:00
    const nextRun = CronParser.getNextRun('*/5 * * * *', baseDate);
    expect(nextRun.getUTCMinutes()).toBe(20);
    expect(nextRun.getUTCSeconds()).toBe(0);
  });

  it('should calculate next run for daily scheduled jobs', () => {
    const baseDate = new Date('2026-09-06T14:30:00Z');
    // Daily job at 08:00
    const nextRun = CronParser.getNextRun('0 8 * * *', baseDate);

    expect(nextRun.getUTCHours()).toBe(8);
    expect(nextRun.getUTCMinutes()).toBe(0);
    // Should be next day
    expect(nextRun.getUTCDate()).toBe(7);
  });
});
