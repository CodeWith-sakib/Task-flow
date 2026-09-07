/**
 * PhiAccrualFailureDetector implements Hayashibara et al.'s Phi Accrual Failure Detector algorithm.
 * Computes failure suspicion metric φ = -log10(P_later(t - t_last)) using a sliding window of heartbeat intervals.
 */
export class PhiAccrualFailureDetector {
  private threshold: number;
  private maxSampleSize: number;
  private minStdDeviationMs: number;
  private intervals: number[] = [];
  private lastHeartbeatTimestamp: number | null = null;

  constructor(options?: {
    threshold?: number;
    maxSampleSize?: number;
    minStdDeviationMs?: number;
  }) {
    this.threshold = options?.threshold ?? 8.0; // φ >= 8 corresponds to ~1 failure per 10^8 detections
    this.maxSampleSize = options?.maxSampleSize ?? 200;
    this.minStdDeviationMs = options?.minStdDeviationMs ?? 50;
  }

  public heartbeat(timestamp: number = Date.now()): void {
    if (this.lastHeartbeatTimestamp !== null) {
      const interval = timestamp - this.lastHeartbeatTimestamp;
      if (interval > 0) {
        this.intervals.push(interval);
        if (this.intervals.length > this.maxSampleSize) {
          this.intervals.shift();
        }
      }
    }
    this.lastHeartbeatTimestamp = timestamp;
  }

  public phi(now: number = Date.now()): number {
    if (this.lastHeartbeatTimestamp === null || this.intervals.length < 2) {
      return 0.0;
    }

    const elapsed = now - this.lastHeartbeatTimestamp;
    const mean = this.computeMean();
    const variance = this.computeVariance(mean);
    const stdDev = Math.max(Math.sqrt(variance), this.minStdDeviationMs);

    const y = (elapsed - mean) / stdDev;
    const e = Math.exp(-y * (1.5976 + 0.070566 * y * y));
    let p = 0;
    if (elapsed > mean) {
      p = e / (1.0 + e);
    } else {
      p = 1.0 - 1.0 / (1.0 + e);
    }

    if (p <= 0.0) {
      return 30.0; // Extreme suspicion cap
    }

    return -Math.log10(p);
  }

  public isAvailable(now: number = Date.now()): boolean {
    return this.phi(now) < this.threshold;
  }

  public reset(): void {
    this.intervals = [];
    this.lastHeartbeatTimestamp = null;
  }

  public getMeanInterval(): number {
    return this.computeMean();
  }

  private computeMean(): number {
    if (this.intervals.length === 0) return 0;
    const sum = this.intervals.reduce((acc, val) => acc + val, 0);
    return sum / this.intervals.length;
  }

  private computeVariance(mean: number): number {
    if (this.intervals.length < 2) return 0;
    const sumSq = this.intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
    return sumSq / (this.intervals.length - 1);
  }
}
