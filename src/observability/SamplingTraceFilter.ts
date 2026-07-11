export class SamplingTraceFilter {
  private sampleRate: number;

  constructor(sampleRate: number = 0.1) { // 10% default
    this.sampleRate = sampleRate;
  }

  public shouldSample(hasError: boolean): boolean {
    if (hasError) return true; // Always sample errors
    return Math.random() < this.sampleRate;
  }
}
