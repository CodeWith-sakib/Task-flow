export class MetricHistogram {
  private samples: number[] = [];

  public record(value: number): void {
    this.samples.push(value);
  }

  public getPercentile(p: number): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  public getCount(): number {
    return this.samples.length;
  }
}
