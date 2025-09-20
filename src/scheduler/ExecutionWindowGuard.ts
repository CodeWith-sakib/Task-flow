export class ExecutionWindowGuard {
  private allowedStartHour: number;
  private allowedEndHour: number;

  constructor(allowedStartHour: number, allowedEndHour: number) {
    this.allowedStartHour = allowedStartHour;
    this.allowedEndHour = allowedEndHour;
  }

  public isWithinWindow(date: Date): boolean {
    const hour = date.getUTCHours();
    if (this.allowedStartHour <= this.allowedEndHour) {
      return hour >= this.allowedStartHour && hour < this.allowedEndHour;
    } else {
      // Overnight window (e.g. 22:00 to 04:00)
      return hour >= this.allowedStartHour || hour < this.allowedEndHour;
    }
  }
}
