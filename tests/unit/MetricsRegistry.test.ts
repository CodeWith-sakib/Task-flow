import { MetricsRegistry } from '../../src/observability/metrics/MetricsRegistry';

describe('MetricsRegistry (Prometheus / OpenMetrics)', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  it('should track counters and export in standard Prometheus text format', () => {
    registry.incrementCounter('taskflow_tasks_created_total', 'Total tasks created', 1, { status: 'queued' });
    registry.incrementCounter('taskflow_tasks_created_total', 'Total tasks created', 2, { status: 'queued' });

    const text = registry.exportPrometheusText();
    expect(text).toContain('# HELP taskflow_tasks_created_total Total tasks created');
    expect(text).toContain('# TYPE taskflow_tasks_created_total counter');
    expect(text).toContain('taskflow_tasks_created_total{status="queued"} 3');
  });

  it('should track gauges for queue depth and worker load', () => {
    registry.setGauge('taskflow_queue_depth', 14, 'Current queue size');
    expect(registry.getGaugeValue('taskflow_queue_depth')).toBe(14);

    const text = registry.exportPrometheusText();
    expect(text).toContain('# TYPE taskflow_queue_depth gauge');
    expect(text).toContain('taskflow_queue_depth 14');
  });

  it('should collect histograms with cumulative buckets', () => {
    registry.registerHistogram('task_latency_ms', 'Execution latency', [50, 100, 200]);

    registry.observeHistogram('task_latency_ms', 40);
    registry.observeHistogram('task_latency_ms', 95);
    registry.observeHistogram('task_latency_ms', 150);

    const text = registry.exportPrometheusText();
    expect(text).toContain('task_latency_ms_bucket{le="50"} 1');
    expect(text).toContain('task_latency_ms_bucket{le="100"} 2');
    expect(text).toContain('task_latency_ms_bucket{le="200"} 3');
    expect(text).toContain('task_latency_ms_bucket{le="+Inf"} 3');
    expect(text).toContain('task_latency_ms_count 3');
    expect(text).toContain('task_latency_ms_sum 285');
  });
});
