/**
 * Predictive Worker Fleet Autoscaler.
 * Combines current queue backlog gradient, processing latency trends,
 * and arrival rate forecasts to proactively scale worker instances up or down.
 */

export interface AutoscalingConfig {
  minWorkers: number;
  maxWorkers: number;
  targetQueueLatencySec: number;
  scaleUpCooldownSec: number;
  scaleDownCooldownSec: number;
  taskDurationSec: number;
}

export class PredictiveWorkerAutoscaler {
  private config: AutoscalingConfig;
  private currentWorkers: number;
  private lastScaleTime: number = 0;
  private historyArrivalRates: number[] = [];

  constructor(config: AutoscalingConfig) {
    this.config = config;
    this.currentWorkers = config.minWorkers;
  }

  public recordArrivalRate(rate: number): void {
    this.historyArrivalRates.push(rate);
    if (this.historyArrivalRates.length > 60) {
      this.historyArrivalRates.shift();
    }
  }

  public evaluate(
    currentQueueLength: number,
    now: number = Date.now()
  ): { targetWorkers: number; action: 'SCALE_UP' | 'SCALE_DOWN' | 'NO_CHANGE'; reason: string } {
    const elapsedSecSinceScale = (now - this.lastScaleTime) / 1000;

    // Forecast arrival rate using linear trend extrapolation
    const forecastedArrivalRate = this.forecastArrivalRate();

    // Required concurrency to clear queue within SLA + handle forecasted arrivals
    const backlogLoad = currentQueueLength / this.config.targetQueueLatencySec;
    const incomingLoad = forecastedArrivalRate;
    const totalRequiredConcurrency = (backlogLoad + incomingLoad) * this.config.taskDurationSec;

    const desiredWorkers = Math.max(
      this.config.minWorkers,
      Math.min(this.config.maxWorkers, Math.ceil(totalRequiredConcurrency))
    );

    if (desiredWorkers > this.currentWorkers) {
      if (elapsedSecSinceScale < this.config.scaleUpCooldownSec) {
        return { targetWorkers: this.currentWorkers, action: 'NO_CHANGE', reason: 'In scale-up cooldown' };
      }
      this.currentWorkers = desiredWorkers;
      this.lastScaleTime = now;
      return {
        targetWorkers: desiredWorkers,
        action: 'SCALE_UP',
        reason: `Scale up: queue=${currentQueueLength}, forecastedRate=${forecastedArrivalRate.toFixed(2)}/s`,
      };
    }

    if (desiredWorkers < this.currentWorkers) {
      if (elapsedSecSinceScale < this.config.scaleDownCooldownSec) {
        return { targetWorkers: this.currentWorkers, action: 'NO_CHANGE', reason: 'In scale-down cooldown' };
      }
      this.currentWorkers = desiredWorkers;
      this.lastScaleTime = now;
      return {
        targetWorkers: desiredWorkers,
        action: 'SCALE_DOWN',
        reason: `Scale down: load reduced to ${desiredWorkers} workers`,
      };
    }

    return { targetWorkers: this.currentWorkers, action: 'NO_CHANGE', reason: 'System in equilibrium' };
  }

  public getCurrentWorkerCount(): number {
    return this.currentWorkers;
  }

  private forecastArrivalRate(): number {
    if (this.historyArrivalRates.length === 0) return 0;
    if (this.historyArrivalRates.length === 1) return this.historyArrivalRates[0];

    const len = this.historyArrivalRates.length;
    const recent = this.historyArrivalRates[len - 1];
    const prev = this.historyArrivalRates[len - 2];
    const delta = recent - prev;

    return Math.max(0, recent + delta * 0.5);
  }
}
