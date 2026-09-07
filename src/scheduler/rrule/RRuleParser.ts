export type Frequency = 'SECONDLY' | 'MINUTELY' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type Weekday = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

export interface ParsedRRule {
  freq: Frequency;
  interval: number;
  count?: number;
  until?: Date;
  byDay?: { day: Weekday; nth?: number }[];
  byMonthDay?: number[];
  byMonth?: number[];
  bySetPos?: number[];
  wkst?: Weekday;
}

/**
 * RRuleParser parses iCalendar RFC 5545 recurrence rule strings into structured recurrence models.
 */
export class RRuleParser {
  public static parse(rruleString: string): ParsedRRule {
    const cleanStr = rruleString.startsWith('RRULE:') ? rruleString.substring(6) : rruleString;
    const parts = cleanStr.split(';');

    const rule: Partial<ParsedRRule> = {
      interval: 1
    };

    for (const part of parts) {
      const [rawKey, rawVal] = part.split('=');
      if (!rawKey || !rawVal) continue;
      const key = rawKey.toUpperCase().trim();
      const val = rawVal.trim();

      switch (key) {
        case 'FREQ':
          rule.freq = val.toUpperCase() as Frequency;
          break;
        case 'INTERVAL':
          rule.interval = parseInt(val, 10) || 1;
          break;
        case 'COUNT':
          rule.count = parseInt(val, 10);
          break;
        case 'UNTIL':
          rule.until = this.parseDate(val);
          break;
        case 'BYDAY':
          rule.byDay = this.parseByDay(val);
          break;
        case 'BYMONTHDAY':
          rule.byMonthDay = val.split(',').map(v => parseInt(v, 10));
          break;
        case 'BYMONTH':
          rule.byMonth = val.split(',').map(v => parseInt(v, 10));
          break;
        case 'BYSETPOS':
          rule.bySetPos = val.split(',').map(v => parseInt(v, 10));
          break;
        case 'WKST':
          rule.wkst = val.toUpperCase() as Weekday;
          break;
      }
    }

    if (!rule.freq) {
      throw new Error(`Invalid RRULE: FREQ is required in '${rruleString}'`);
    }

    return rule as ParsedRRule;
  }

  private static parseByDay(val: string): { day: Weekday; nth?: number }[] {
    return val.split(',').map(item => {
      const match = item.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i);
      if (!match) {
        return { day: item.toUpperCase() as Weekday };
      }
      return {
        day: match[2].toUpperCase() as Weekday,
        nth: match[1] ? parseInt(match[1], 10) : undefined
      };
    });
  }

  private static parseDate(val: string): Date {
    // Format: YYYYMMDDTHHMMSSZ or YYYYMMDD
    if (val.length === 8) {
      const year = parseInt(val.substring(0, 4), 10);
      const month = parseInt(val.substring(4, 6), 10) - 1;
      const day = parseInt(val.substring(6, 8), 10);
      return new Date(Date.UTC(year, month, day));
    }
    const year = parseInt(val.substring(0, 4), 10);
    const month = parseInt(val.substring(4, 6), 10) - 1;
    const day = parseInt(val.substring(6, 8), 10);
    const hour = parseInt(val.substring(9, 11), 10);
    const min = parseInt(val.substring(11, 13), 10);
    const sec = parseInt(val.substring(13, 15), 10);
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }
}
