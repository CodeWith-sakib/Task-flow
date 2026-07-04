export class AnomalyDetector {
  public static isAnomaly(baseline: number[], current: number, thresholdStdDevs: number = 2): boolean {
    if (baseline.length < 2) return false;
    const mean = baseline.reduce((acc, v) => acc + v, 0) / baseline.length;
    const variance = baseline.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / baseline.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return current !== mean;
    return (current - mean) > (thresholdStdDevs * stdDev);
  }
}
