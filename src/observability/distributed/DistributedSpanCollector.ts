/**
 * Distributed Trace Span Collector.
 * Ingests, buffers, samples, and stitches distributed spans across
 * cluster nodes into complete execution DAG trace trees.
 */

export interface SpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTimeUs: number;
  durationUs: number;
  tags: Record<string, string | number | boolean>;
  logs: { timestampUs: number; event: string; fields?: Record<string, any> }[];
}

export interface TraceTree {
  traceId: string;
  rootSpan?: SpanRecord;
  spans: SpanRecord[];
  totalDurationUs: number;
}

export class DistributedSpanCollector {
  private spansByTrace = new Map<string, SpanRecord[]>();
  private maxTraces: number;
  private sampleRate: number; // 0.0 to 1.0

  constructor(maxTraces: number = 5000, sampleRate: number = 1.0) {
    this.maxTraces = maxTraces;
    this.sampleRate = sampleRate;
  }

  public recordSpan(span: SpanRecord): boolean {
    if (this.sampleRate < 1.0 && Math.random() > this.sampleRate) {
      return false; // sampled out
    }

    let traceSpans = this.spansByTrace.get(span.traceId);
    if (!traceSpans) {
      if (this.spansByTrace.size >= this.maxTraces) {
        // Evict oldest trace
        const firstKey = this.spansByTrace.keys().next().value;
        if (firstKey) this.spansByTrace.delete(firstKey);
      }
      traceSpans = [];
      this.spansByTrace.set(span.traceId, traceSpans);
    }

    traceSpans.push({ ...span });
    return true;
  }

  public getTraceTree(traceId: string): TraceTree | null {
    const spans = this.spansByTrace.get(traceId);
    if (!spans || spans.length === 0) return null;

    const rootSpan = spans.find((s) => !s.parentSpanId);

    const minStart = Math.min(...spans.map((s) => s.startTimeUs));
    const maxEnd = Math.max(...spans.map((s) => s.startTimeUs + s.durationUs));

    return {
      traceId,
      rootSpan,
      spans: [...spans],
      totalDurationUs: maxEnd - minStart,
    };
  }

  public searchSpans(filter: { operationName?: string; tagKey?: string; tagValue?: any }): SpanRecord[] {
    const results: SpanRecord[] = [];

    for (const spans of this.spansByTrace.values()) {
      for (const span of spans) {
        if (filter.operationName && span.operationName !== filter.operationName) continue;
        if (filter.tagKey && span.tags[filter.tagKey] !== filter.tagValue) continue;
        results.push(span);
      }
    }

    return results;
  }

  public clear(): void {
    this.spansByTrace.clear();
  }
}
