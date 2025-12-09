import { TraceContext } from '../../src/observability/tracing/TraceContext';

describe('TraceContext (W3C Distributed Tracing)', () => {
  it('should generate valid W3C traceparent headers', () => {
    const trace = TraceContext.create(true);
    const header = trace.toTraceParent();

    expect(header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('should parse valid traceparent headers correctly', () => {
    const raw = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const parsed = TraceContext.fromTraceParent(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(parsed?.spanId).toBe('00f067aa0ba902b7');
    expect(parsed?.traceFlags).toBe('01');
  });

  it('should propagate traceId across child spans with distinct spanIds', () => {
    const parent = TraceContext.create();
    const child = parent.createChildSpan();

    expect(child.traceId).toBe(parent.traceId);
    expect(child.spanId).not.toBe(parent.spanId);
  });

  it('should reject malformed traceparent headers', () => {
    expect(TraceContext.fromTraceParent('')).toBeNull();
    expect(TraceContext.fromTraceParent('invalid-header')).toBeNull();
    expect(TraceContext.fromTraceParent('01-abc-123-00')).toBeNull(); // Unsupported version
  });
});
