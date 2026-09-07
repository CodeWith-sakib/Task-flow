import { ParsedRRule } from './RRuleParser';

/**
 * RRuleIterator generates subsequent occurrence timestamps from a starting anchor date
 * following RFC 5545 recurrence rules.
 */
export class RRuleIterator {
  private rule: ParsedRRule;
  private dtStart: Date;
  private current: Date;
  private countGenerated: number = 0;

  constructor(rule: ParsedRRule, dtStart: Date = new Date()) {
    this.rule = rule;
    this.dtStart = new Date(dtStart.getTime());
    this.current = new Date(dtStart.getTime());
  }

  public next(): Date | null {
    if (this.rule.count !== undefined && this.countGenerated >= this.rule.count) {
      return null;
    }

    if (this.countGenerated === 0) {
      this.countGenerated++;
      return new Date(this.dtStart.getTime());
    }

    const nextDate = this.computeNext(this.current);
    if (!nextDate) return null;

    if (this.rule.until && nextDate.getTime() > this.rule.until.getTime()) {
      return null;
    }

    this.current = nextDate;
    this.countGenerated++;
    return new Date(nextDate.getTime());
  }

  public take(maxCount: number): Date[] {
    const dates: Date[] = [];
    while (dates.length < maxCount) {
      const n = this.next();
      if (!n) break;
      dates.push(n);
    }
    return dates;
  }

  private computeNext(from: Date): Date | null {
    const next = new Date(from.getTime());
    const interval = this.rule.interval || 1;

    switch (this.rule.freq) {
      case 'SECONDLY':
        next.setUTCSeconds(next.getUTCSeconds() + interval);
        break;
      case 'MINUTELY':
        next.setUTCMinutes(next.getUTCMinutes() + interval);
        break;
      case 'HOURLY':
        next.setUTCHours(next.getUTCHours() + interval);
        break;
      case 'DAILY':
        next.setUTCDate(next.getUTCDate() + interval);
        break;
      case 'WEEKLY':
        next.setUTCDate(next.getUTCDate() + (7 * interval));
        break;
      case 'MONTHLY':
        next.setUTCMonth(next.getUTCMonth() + interval);
        break;
      case 'YEARLY':
        next.setUTCFullYear(next.getUTCFullYear() + interval);
        break;
      default:
        return null;
    }

    return next;
  }
}
