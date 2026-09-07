export interface PIDConfig {
  kp?: number; // Proportional gain
  ki?: number; // Integral gain
  kd?: number; // Derivative gain
  targetQueueDepth?: number;
  minWorkers?: number;
  maxWorkers?: number;
}

/**
 * PIDQueueController implements Proportional-Integral-Derivative closed-loop feedback control
 * to continuously adjust worker allocations and maintain steady queue depth.
 */
export class PIDQueueController {
  private kp: number;
  private ki: number;
  private kd: number;
  private targetQueueDepth: number;
  private minWorkers: number;
  private maxWorkers: number;

  private integralError: number = 0;
  private lastError: number = 0;
  private currentWorkers: number;

  constructor(config?: PIDConfig) {
    this.kp = config?.kp ?? 0.5;
    this.ki = config?.ki ?? 0.1;
    this.kd = config?.kd ?? 0.2;
    this.targetQueueDepth = config?.targetQueueDepth ?? 10;
    this.minWorkers = config?.minWorkers ?? 2;
    this.maxWorkers = config?.maxWorkers ?? 100;
    this.currentWorkers = this.minWorkers;
  }

  public update(currentQueueDepth: number, dtSeconds: number = 1.0): number {
    const error = currentQueueDepth - this.targetQueueDepth;

    // Proportional term
    const pTerm = this.kp * error;

    // Integral term with anti-windup clamping
    this.integralError += error * dtSeconds;
    this.integralError = Math.max(-50, Math.min(50, this.integralError));
    const iTerm = this.ki * this.integralError;

    // Derivative term
    const dError = dtSeconds > 0 ? (error - this.lastError) / dtSeconds : 0;
    const dTerm = this.kd * dError;

    this.lastError = error;

    const controlOutput = pTerm + iTerm + dTerm;
    this.currentWorkers = Math.max(
      this.minWorkers,
      Math.min(this.maxWorkers, Math.round(this.currentWorkers + controlOutput))
    );

    return this.currentWorkers;
  }

  public getWorkerTarget(): number {
    return this.currentWorkers;
  }

  public reset(): void {
    this.integralError = 0;
    this.lastError = 0;
    this.currentWorkers = this.minWorkers;
  }
}
