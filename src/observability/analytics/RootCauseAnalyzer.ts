/**
 * Automated Root Cause & Failure Clustering Analyzer.
 * Analyzes workflow execution traces, error cascades, and dependency bottlenecks
 * to pinpoint initial root cause events vs secondary cascading failures.
 */

export interface ExecutionEventLog {
  taskId: string;
  workflowId: string;
  timestamp: number;
  status: 'SUCCESS' | 'FAILURE';
  errorCategory?: string;
  errorMessage?: string;
  durationMs: number;
  upstreamTaskIds: string[];
}

export interface RootCauseDiagnosis {
  workflowId: string;
  initialFailureTaskId: string;
  initialErrorCategory: string;
  cascadedTaskIds: string[];
  bottleneckTaskIds: string[];
  confidenceScore: number;
  recommendations: string[];
}

export class RootCauseAnalyzer {
  public analyze(events: ExecutionEventLog[]): RootCauseDiagnosis | null {
    if (events.length === 0) return null;

    const workflowId = events[0].workflowId;
    const failures = events.filter((e) => e.status === 'FAILURE');

    // 1. Identify bottlenecks (tasks with duration > 2x average duration)
    const avgDuration = events.reduce((acc, e) => acc + e.durationMs, 0) / events.length;
    const bottleneckTaskIds = events
      .filter((e) => e.durationMs > avgDuration * 2.5 && e.status === 'SUCCESS')
      .map((e) => e.taskId);

    if (failures.length === 0) {
      return {
        workflowId,
        initialFailureTaskId: '',
        initialErrorCategory: 'NONE',
        cascadedTaskIds: [],
        bottleneckTaskIds,
        confidenceScore: 1.0,
        recommendations: bottleneckTaskIds.length > 0 ? ['Optimize bottleneck task dependencies'] : ['Workflow completed healthy'],
      };
    }

    // 2. Sort failures chronologically to find initial root failure
    failures.sort((a, b) => a.timestamp - b.timestamp);
    const initialFailure = failures[0];

    // 3. Find cascaded downstream failures
    const failedSet = new Set(failures.map((f) => f.taskId));
    const cascadedTaskIds: string[] = [];

    for (let i = 1; i < failures.length; i++) {
      const f = failures[i];
      if (f.upstreamTaskIds.some((up) => failedSet.has(up))) {
        cascadedTaskIds.push(f.taskId);
      }
    }

    const recommendations: string[] = [];
    const cat = initialFailure.errorCategory || 'GENERIC_ERROR';

    if (cat.includes('TIMEOUT') || cat.includes('DEADLINE')) {
      recommendations.push('Increase timeout threshold or check downstream service latency');
    } else if (cat.includes('NETWORK') || cat.includes('CONNECTION')) {
      recommendations.push('Enable circuit breaker and exponential backoff retry');
    } else if (cat.includes('QUOTA') || cat.includes('RATE_LIMIT')) {
      recommendations.push('Adjust concurrency quota or request rate limiter tokens');
    } else {
      recommendations.push('Inspect task stack trace and input payloads');
    }

    return {
      workflowId,
      initialFailureTaskId: initialFailure.taskId,
      initialErrorCategory: cat,
      cascadedTaskIds,
      bottleneckTaskIds,
      confidenceScore: 0.95,
      recommendations,
    };
  }
}
