export interface SpanData {
  traceId: string;
  spanId: string;
  name: string;
  startTime: number;
  endTime: number;
  attributes?: Record<string, unknown>;
}

export class SpanExporter {
  private buffer: SpanData[] = [];

  public exportSpan(span: SpanData): void {
    this.buffer.push(span);
  }

  public flushJson(): string {
    const json = JSON.stringify(this.buffer);
    this.buffer = [];
    return json;
  }

  public pendingCount(): number {
    return this.buffer.length;
  }
}
