export class ScheduleDriftDetector {
  private driftThresholdMs: number;

  constructor(driftThresholdMs: number = 1000) {
    this.driftThresholdMs = driftThresholdMs;
  }

  public checkDrift(scheduledTime: number, actualTime: number): {
    driftMs: number;
    hasExcessiveDrift: boolean;
  } {
    const driftMs = Math.abs(actualTime - scheduledTime);
    return {
      driftMs,
      hasExcessiveDrift: driftMs > this.driftThresholdMs
    };
  }
}
