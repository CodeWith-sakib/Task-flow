export interface AnomalyReport {
  isAnomaly: boolean;
  value: number;
  expectedMean: number;
  stdDev: number;
  zScore: number;
  thresholdZ: number;
}

/**
 * EWMAAnomalyDetector tracks streaming metrics using Exponentially Weighted Moving Average (EWMA)
 * and Exponentially Weighted Moving Variance to dynamically identify statistical anomalies.
 */
export class EWMAAnomalyDetector {
  private alpha: number; // Smoothing factor (0 < alpha < 1)
  private thresholdZ: number; // Z-score threshold for anomaly flag
  private mean: number | null = null;
  private variance: number | null = null;
  private sampleCount: number = 0;

  constructor(alpha: number = 0.2, thresholdZ: number = 3.0) {
    this.alpha = alpha;
    this.thresholdZ = thresholdZ;
  }

  public observe(value: number): AnomalyReport {
    this.sampleCount++;

    if (this.mean === null || this.variance === null) {
      this.mean = value;
      this.variance = 0;
      return {
        isAnomaly: false,
        value,
        expectedMean: value,
        stdDev: 0,
        zScore: 0,
        thresholdZ: this.thresholdZ
      };
    }

    const stdDev = Math.sqrt(Math.max(0.0001, this.variance));
    const zScore = stdDev > 0 ? (value - this.mean) / stdDev : 0;
    const isAnomaly = this.sampleCount > 5 && Math.abs(zScore) >= this.thresholdZ;

    // Update EWMA mean and variance
    const diff = value - this.mean;
    const incr = this.alpha * diff;
    this.mean = this.mean + incr;
    this.variance = (1 - this.alpha) * (this.variance + diff * incr);

    return {
      isAnomaly,
      value,
      expectedMean: this.mean,
      stdDev,
      zScore,
      thresholdZ: this.thresholdZ
    };
  }

  public getMean(): number {
    return this.mean ?? 0;
  }

  public getStdDev(): number {
    return Math.sqrt(Math.max(0, this.variance ?? 0));
  }

  public reset(): void {
    this.mean = null;
    this.variance = null;
    this.sampleCount = 0;
  }
}
