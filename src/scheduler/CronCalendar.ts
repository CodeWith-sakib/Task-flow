export class CronCalendar {
  private blackouts: Set<string> = new Set(); // YYYY-MM-DD format

  public addBlackoutDate(dateStr: string): void {
    this.blackouts.add(dateStr);
  }

  public isBlackout(date: Date): boolean {
    const key = date.toISOString().split('T')[0];
    return this.blackouts.has(key);
  }

  public isWeekend(date: Date): boolean {
    const day = date.getUTCDay();
    return day === 0 || day === 6;
  }

  public canRun(date: Date, allowWeekends: boolean = true): boolean {
    if (this.isBlackout(date)) return false;
    if (!allowWeekends && this.isWeekend(date)) return false;
    return true;
  }
}
