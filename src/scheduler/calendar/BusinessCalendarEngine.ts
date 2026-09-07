export interface WorkingHours {
  startHour: number; // 0-23
  endHour: number;   // 0-23
}

export interface CalendarConfig {
  timezone?: string;
  weekendDays?: number[]; // 0 = Sunday, 6 = Saturday
  workingHours?: WorkingHours;
  holidays?: string[]; // 'YYYY-MM-DD'
  blackoutWindows?: { start: string; end: string }[]; // ISO strings
}

/**
 * BusinessCalendarEngine evaluates business working hours, holiday exclusions,
 * and shifts non-business triggers to the nearest valid execution window.
 */
export class BusinessCalendarEngine {
  private weekendDays: Set<number>;
  private workingHours: WorkingHours;
  private holidays: Set<string>;
  private blackoutWindows: { start: number; end: number }[];

  constructor(config?: CalendarConfig) {
    this.weekendDays = new Set(config?.weekendDays ?? [0, 6]);
    this.workingHours = config?.workingHours ?? { startHour: 9, endHour: 17 };
    this.holidays = new Set(config?.holidays ?? []);
    this.blackoutWindows = (config?.blackoutWindows ?? []).map(w => ({
      start: new Date(w.start).getTime(),
      end: new Date(w.end).getTime()
    }));
  }

  public isBusinessDay(date: Date): boolean {
    const dayOfWeek = date.getUTCDay();
    if (this.weekendDays.has(dayOfWeek)) {
      return false;
    }

    const dateStr = this.formatDateString(date);
    if (this.holidays.has(dateStr)) {
      return false;
    }

    return true;
  }

  public isWithinWorkingHours(date: Date): boolean {
    if (!this.isBusinessDay(date)) return false;

    const hour = date.getUTCHours();
    return hour >= this.workingHours.startHour && hour < this.workingHours.endHour;
  }

  public isInBlackoutWindow(date: Date): boolean {
    const time = date.getTime();
    return this.blackoutWindows.some(w => time >= w.start && time <= w.end);
  }

  public isExecutionPermitted(date: Date): boolean {
    return this.isWithinWorkingHours(date) && !this.isInBlackoutWindow(date);
  }

  public getNextValidBusinessExecutionTime(from: Date): Date {
    let current = new Date(from.getTime());

    while (!this.isExecutionPermitted(current)) {
      if (!this.isBusinessDay(current)) {
        // Jump to next day at working startHour
        current.setUTCDate(current.getUTCDate() + 1);
        current.setUTCHours(this.workingHours.startHour, 0, 0, 0);
      } else if (current.getUTCHours() < this.workingHours.startHour) {
        current.setUTCHours(this.workingHours.startHour, 0, 0, 0);
      } else if (current.getUTCHours() >= this.workingHours.endHour) {
        current.setUTCDate(current.getUTCDate() + 1);
        current.setUTCHours(this.workingHours.startHour, 0, 0, 0);
      } else {
        // Inside blackout window, jump 15 minutes forward
        current.setUTCMinutes(current.getUTCMinutes() + 15);
      }
    }

    return current;
  }

  private formatDateString(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
