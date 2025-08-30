export class TimeZoneSupportHelper {
  public static getUtcOffsetHours(timeZone: string): number {
    try {
      const now = new Date();
      const str = now.toLocaleString('en-US', { timeZone, timeZoneName: 'shortOffset' });
      const match = str.match(/GMT([+-]\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  public static isUtc(timeZone: string): boolean {
    return timeZone.toUpperCase() === 'UTC' || timeZone.toUpperCase() === 'ETC/UTC';
  }
}
