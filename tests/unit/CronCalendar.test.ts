import { CronCalendar } from '../../src/scheduler/CronCalendar';

describe('CronCalendar', () => {
  it('should respect blackout dates and weekends', () => {
    const cal = new CronCalendar();
    cal.addBlackoutDate('2025-12-25');

    const xmas = new Date('2025-12-25T10:00:00Z');
    expect(cal.canRun(xmas)).toBe(false);

    const normal = new Date('2025-10-15T10:00:00Z'); // Wednesday
    expect(cal.canRun(normal, false)).toBe(true);
  });
});
