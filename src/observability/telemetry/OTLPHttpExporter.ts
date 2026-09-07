import { OTLPProtoSerializer, SpanData } from './OTLPProtoSerializer';

export interface OTLPExporterOptions {
  endpoint?: string;
  serviceName?: string;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  headers?: Record<string, string>;
}

export type SpanTransport = (url: string, body: string, headers: Record<string, string>) => Promise<boolean>;

/**
 * OTLPHttpExporter batches trace spans in-memory and exports them to an OTLP/HTTP collector.
 */
export class OTLPHttpExporter {
  private endpoint: string;
  private serviceName: string;
  private maxBatchSize: number;
  private flushIntervalMs: number;
  private headers: Record<string, string>;
  private buffer: SpanData[] = [];
  private timer: NodeJS.Timeout | null = null;
  private transport?: SpanTransport;
  private isExporting: boolean = false;

  constructor(options?: OTLPExporterOptions, transport?: SpanTransport) {
    this.endpoint = options?.endpoint ?? 'http://localhost:4318/v1/traces';
    this.serviceName = options?.serviceName ?? 'taskflow-engine';
    this.maxBatchSize = options?.maxBatchSize ?? 100;
    this.flushIntervalMs = options?.flushIntervalMs ?? 5000;
    this.headers = options?.headers ?? { 'Content-Type': 'application/json' };
    this.transport = transport;
  }

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush().catch(() => {});
  }

  public export(span: SpanData): void {
    this.buffer.push(span);
    if (this.buffer.length >= this.maxBatchSize) {
      this.flush().catch(() => {});
    }
  }

  public async flush(): Promise<number> {
    if (this.buffer.length === 0 || this.isExporting) {
      return 0;
    }

    this.isExporting = true;
    const batch = this.buffer.splice(0, this.maxBatchSize);

    try {
      const payload = OTLPProtoSerializer.serializeSpans(this.serviceName, batch);
      const body = JSON.stringify(payload);

      if (this.transport) {
        await this.transport(this.endpoint, body, this.headers);
      }
      return batch.length;
    } catch (err) {
      // Re-queue failed batch up to buffer capacity
      if (this.buffer.length < this.maxBatchSize * 5) {
        this.buffer.unshift(...batch);
      }
      return 0;
    } finally {
      this.isExporting = false;
    }
  }

  public getPendingCount(): number {
    return this.buffer.length;
  }
}
