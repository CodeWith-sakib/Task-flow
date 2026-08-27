export class ExponentialMovingAverage {
  private alpha: number;
  private currentAvg: number | null = null;

  constructor(alpha: number = 0.2) {
    this.alpha = alpha;
  }

  public update(value: number): number {
    if (this.currentAvg === null) {
      this.currentAvg = value;
    } else {
      this.currentAvg = (this.alpha * value) + ((1 - this.alpha) * this.currentAvg);
    }
    return this.currentAvg;
  }

  public getAverage(): number {
    return this.currentAvg ?? 0;
  }
}
