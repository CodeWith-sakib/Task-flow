/**
 * Adaptive Dynamic Slot & Worker Allocator.
 * Combines current queue backlog gradients, SLA thresholds, and workload forecasts
 * to dynamically adjust concurrency limits and worker thread allocations.
 */

import { WorkloadPredictor } from './WorkloadPredictor';

export interface AllocationPolicy {
  minSlots: number;
  maxSlots: number;
  targetQueueLatencyMs: number;
  averageTaskDurationMs: number;
}

export class AdaptiveSlotAllocator {
  private policy: AllocationPolicy;
  private predictor: WorkloadPredictor;
  private currentSlots: number;

  constructor(policy: AllocationPolicy, predictor?: WorkloadPredictor) {
    this.policy = policy;
    this.predictor = predictor || new WorkloadPredictor();
    this.currentSlots = policy.minSlots;
  }

  public evaluate(currentQueueDepth: number, currentThroughputPerSec: number): { recommendedSlots: number; reason: string } {
    this.predictor.update(currentThroughputPerSec);
    const forecast = this.predictor.predict(1);

    // Required capacity to clear backlog within target SLA latency
    const backlogSlots = Math.ceil(
      (currentQueueDepth * this.policy.averageTaskDurationMs) / this.policy.targetQueueLatencyMs
    );

    // Required capacity for forecasted incoming traffic
    const forecastSlots = Math.ceil(forecast.predictedArrivalRate * (this.policy.averageTaskDurationMs / 1000));

    let desiredSlots = Math.max(backlogSlots, forecastSlots);

    // Apply policy clamps
    desiredSlots = Math.max(this.policy.minSlots, Math.min(this.policy.maxSlots, desiredSlots));

    let reason = 'Steady state';
    if (desiredSlots > this.currentSlots) {
      reason = `Scale up triggered: backlog=${currentQueueDepth}, forecast=${forecast.predictedArrivalRate.toFixed(1)}/s`;
    } else if (desiredSlots < this.currentSlots) {
      reason = `Scale down triggered: workload declining`;
    }

    this.currentSlots = desiredSlots;

    return {
      recommendedSlots: desiredSlots,
      reason,
    };
  }

  public getCurrentSlots(): number {
    return this.currentSlots;
  }
}
