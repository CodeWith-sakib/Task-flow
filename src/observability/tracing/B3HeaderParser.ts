export interface B3Context {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

/**
 * B3HeaderParser parses Zipkin B3 Single and Multi-header tracing propagation specs.
 */
export class B3HeaderParser {
  public static parseSingleHeader(header: string): B3Context | null {
    if (!header) return null;
    const parts = header.trim().split('-');
    if (parts.length < 2) return null;

    const traceId = parts[0];
    const spanId = parts[1];
    const sampled = parts.length >= 3 ? (parts[2] === '1' || parts[2] === 'd') : true;
    const parentSpanId = parts.length >= 4 ? parts[3] : undefined;

    return { traceId, spanId, parentSpanId, sampled };
  }

  public static parseMultiHeaders(headers: Record<string, string | undefined>): B3Context | null {
    const traceId = headers['x-b3-traceid'] || headers['X-B3-TraceId'];
    const spanId = headers['x-b3-spanid'] || headers['X-B3-SpanId'];
    if (!traceId || !spanId) return null;

    const sampledVal = headers['x-b3-sampled'] || headers['X-B3-Sampled'];
    const sampled = sampledVal === '1' || sampledVal === 'true';
    const parentSpanId = headers['x-b3-parentspanid'] || headers['X-B3-ParentSpanId'];

    return { traceId, spanId, parentSpanId, sampled };
  }

  public static formatSingle(ctx: B3Context): string {
    const sampledStr = ctx.sampled ? '1' : '0';
    if (ctx.parentSpanId) {
      return `${ctx.traceId}-${ctx.spanId}-${sampledStr}-${ctx.parentSpanId}`;
    }
    return `${ctx.traceId}-${ctx.spanId}-${sampledStr}`;
  }
}
