import { SpanExporter } from '../../src/observability/SpanExporter';

describe('SpanExporter', () => {
  it('should buffer spans and export them as JSON', () => {
    const exporter = new SpanExporter();
    exporter.exportSpan({
      traceId: 't1',
      spanId: 's1',
      name: 'executeTask',
      startTime: 100,
      endTime: 150
    });

    expect(exporter.pendingCount()).toBe(1);
    const json = exporter.flushJson();
    expect(JSON.parse(json)[0].name).toBe('executeTask');
    expect(exporter.pendingCount()).toBe(0);
  });
});
