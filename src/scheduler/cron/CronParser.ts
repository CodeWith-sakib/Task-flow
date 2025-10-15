export class CronParser {
  private static parseField(field: string, min: number, max: number): Set<number> {
    const values = new Set<number>();

    const parts = field.split(',');
    for (const part of parts) {
      if (part === '*') {
        for (let i = min; i <= max; i++) values.add(i);
      } else if (part.includes('/')) {
        const [rangeStr, stepStr] = part.split('/');
        const step = parseInt(stepStr, 10);
        if (isNaN(step) || step <= 0) throw new Error(`Invalid step in cron: ${part}`);

        let start = min;
        let end = max;
        if (rangeStr !== '*') {
          if (rangeStr.includes('-')) {
            const [rStart, rEnd] = rangeStr.split('-').map(Number);
            start = rStart;
            end = rEnd;
          } else {
            start = parseInt(rangeStr, 10);
          }
        }
        for (let i = start; i <= end; i += step) {
          if (i >= min && i <= max) values.add(i);
        }
      } else if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (isNaN(start) || isNaN(end) || start > end) {
          throw new Error(`Invalid range in cron: ${part}`);
        }
        for (let i = start; i <= end; i++) {
          if (i >= min && i <= max) values.add(i);
        }
      } else {
        const val = parseInt(part, 10);
        if (isNaN(val) || val < min || val > max) {
          throw new Error(`Invalid field value ${part} (expected ${min}-${max})`);
        }
        values.add(val);
      }
    }

    return values;
  }

  static validate(expression: string): boolean {
    try {
      const fields = expression.trim().split(/\s+/);
      if (fields.length !== 5) return false;

      this.parseField(fields[0], 0, 59); // Minute
      this.parseField(fields[1], 0, 23); // Hour
      this.parseField(fields[2], 1, 31); // Day of Month
      this.parseField(fields[3], 1, 12); // Month
      this.parseField(fields[4], 0, 6);  // Day of Week
      return true;
    } catch {
      return false;
    }
  }

  static getNextRun(expression: string, fromDate: Date = new Date()): Date {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) {
      throw new Error(`Invalid cron expression format (expected 5 fields): '${expression}'`);
    }

    const minutes = this.parseField(fields[0], 0, 59);
    const hours = this.parseField(fields[1], 0, 23);
    const daysOfMonth = this.parseField(fields[2], 1, 31);
    const months = this.parseField(fields[3], 1, 12);
    const daysOfWeek = this.parseField(fields[4], 0, 6);

    // Advance to next full minute
    const current = new Date(fromDate.getTime() + 60000);
    current.setSeconds(0, 0);

    const maxIterations = 525600; // 1 full year in minutes
    let iterations = 0;

    while (iterations < maxIterations) {
      const m = current.getUTCMinutes();
      const h = current.getUTCHours();
      const dom = current.getUTCDate();
      const mon = current.getUTCMonth() + 1;
      const dow = current.getUTCDay();

      if (
        months.has(mon) &&
        daysOfMonth.has(dom) &&
        daysOfWeek.has(dow) &&
        hours.has(h) &&
        minutes.has(m)
      ) {
        return new Date(current);
      }

      current.setTime(current.getTime() + 60000);
      iterations++;
    }

    throw new Error(`Unable to find next run time for cron '${expression}' within 1 year`);
  }
}
