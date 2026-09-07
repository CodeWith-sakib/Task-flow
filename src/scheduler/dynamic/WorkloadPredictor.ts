/**
 * Predictive Workload Forecaster.
 * Implements Holt-Winters Double Exponential Smoothing (level + trend)
 * to forecast upcoming task arrival rates and prevent SLA violations before queues build up.
 */

export interface WorkloadForecast {
  predictedArrivalRate: number;
  trend: number;
  confidenceInterval: { lower: number; upper: number };
}

export class WorkloadPredictor {
  private alpha: number; // Level smoothing parameter (0 < alpha < 1)
  private beta: number; // Trend smoothing parameter (0 < beta < 1)
  private level: number = 0;
  private trend: number = 0;
  private isInitialized = false;
  private history: number[] = [];

  constructor(alpha: number = 0.3, beta: number = 0.1) {
    this.alpha = alpha;
    this.beta = beta;
  }

  public update(actualArrivalRate: number): void {
    this.history.push(actualArrivalRate);
    if (this.history.length > 500) {
      this.history.shift();
    }

    if (!this.isInitialized) {
      this.level = actualArrivalRate;
      this.trend = 0;
      this.isInitialized = true;
      return;
    }

    const prevLevel = this.level;
    this.level = this.alpha * actualArrivalRate + (1 - this.alpha) * (this.level + this.trend);
    this.trend = this.beta * (this.level - prevLevel) + (1 - this.beta) * this.trend;
  }

  public predict(horizonSteps: number = 1): WorkloadForecast {
    if (!this.isInitialized) {
      return {
        predictedArrivalRate: 0,
        trend: 0,
        confidenceInterval: { lower: 0, upper: 0 },
      };
    }

    const forecast = Math.max(0, this.level + horizonSteps * this.trend);
    const stdDev = this.computeStdDev();

    return {
      predictedArrivalRate: forecast,
      trend: this.trend,
      confidenceInterval: {
        lower: Math.max(0, forecast - 1.96 * stdDev),
        upper: forecast + 1.96 * stdDev,
      },
    };
  }

  private computeStdDev(): number {
    if (this.history.length < 2) return 1.0;
    const mean = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    const variance = this.history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.history.length;
    return Math.sqrt(variance);
  }
}
