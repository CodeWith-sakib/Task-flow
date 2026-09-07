import { PrometheusExporter } from '../../src/observability/metrics/PrometheusExporter';
import { HDRHistogram } from '../../src/observability/metrics/HDRHistogram';
import { RollingWindowRollup } from '../../src/observability/metrics/RollingWindowRollup';
import { ExecutionFlameGraphGenerator } from '../../src/observability/profiler/ExecutionFlameGraphGenerator';
import { DistributedSpanCollector } from '../../src/observability/distributed/DistributedSpanCollector';

describe('Observability & Telemetry Integration Tests', () => {
  it('should export Prometheus metrics in text format', () => {
    const exporter = new PrometheusExporter();
    exporter.register('tasks_completed_total', 'Total number of completed tasks', 'counter', { queue: 'high' }, 15);
    exporter.register('worker_active_threads', 'Active worker threads', 'gauge', {}, 8);

    const metricsText = exporter.renderText();
    expect(metricsText).toContain('# HELP tasks_completed_total Total number of completed tasks');
    expect(metricsText).toContain('# TYPE tasks_completed_total counter');
    expect(metricsText).toContain('tasks_completed_total{queue="high"} 15');
    expect(metricsText).toContain('worker_active_threads 8');
  });

  it('should calculate high dynamic range (HDR) percentiles', () => {
    const hdr = new HDRHistogram(2000);
    for (let i = 1; i <= 1000; i++) {
      hdr.record(i);
    }

    expect(hdr.getPercentile(50)).toBeGreaterThan(0);
    expect(hdr.getPercentile(90)).toBeGreaterThan(hdr.getPercentile(50));
    expect(hdr.getPercentile(99)).toBeGreaterThan(hdr.getPercentile(90));
  });

  it('should aggregate metrics over rolling time windows', () => {
    const rollup = new RollingWindowRollup(60000, 100);
    const now = Date.now();

    rollup.record(10, now - 10000);
    rollup.record(20, now - 5000);
    rollup.record(30, now);

    const buckets = rollup.getBuckets();
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets[0].sum).toBe(60);
    expect(buckets[0].avg).toBe(20);
  });

  it('should generate hierarchical execution profiles and speedscope profile JSON', () => {
    const flameGen = new ExecutionFlameGraphGenerator();
    flameGen.startSpan('root', 'WorkflowEngine.execute', 'workflow');
    flameGen.startSpan('c1', 'DAGValidator.validate', 'compute', 'root');
    flameGen.endSpan('c1');
    flameGen.startSpan('c2', 'TaskExecutionPipeline.run', 'compute', 'root');
    flameGen.endSpan('c2');
    flameGen.endSpan('root');

    const profile = flameGen.toSpeedScopeProfile();
    expect(profile.version).toBe('0.0.1');
    expect(profile.profiles.length).toBe(1);
    expect(profile.profiles[0].name).toBe('WorkflowEngine.execute');
  });

  it('should collect and correlate distributed trace spans into trees', () => {
    const collector = new DistributedSpanCollector();
    const traceId = 'trace-abcdef-123456';

    collector.recordSpan({
      traceId,
      spanId: 'span-root',
      operationName: 'HTTP POST /api/v1/tasks',
      startTimeUs: 1000000,
      durationUs: 50000,
      tags: { 'http.status_code': 200 },
      logs: [],
    });

    collector.recordSpan({
      traceId,
      spanId: 'span-child',
      parentSpanId: 'span-root',
      operationName: 'TaskService.createTask',
      startTimeUs: 1010000,
      durationUs: 30000,
      tags: { 'task.id': 't-991' },
      logs: [],
    });

    const traceTree = collector.getTraceTree(traceId);
    expect(traceTree).not.toBeNull();
    expect(traceTree?.spans.length).toBe(2);
    expect(traceTree?.rootSpan?.spanId).toBe('span-root');
  });
});
