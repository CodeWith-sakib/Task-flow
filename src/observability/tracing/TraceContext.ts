import * as crypto from 'crypto';

export class TraceContext {
  readonly version: string = '00';
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: string;

  constructor(traceId?: string, spanId?: string, traceFlags: string = '01') {
    this.traceId = traceId || crypto.randomBytes(16).toString('hex');
    this.spanId = spanId || crypto.randomBytes(8).toString('hex');
    this.traceFlags = traceFlags;
  }

  toTraceParent(): string {
    return `${this.version}-${this.traceId}-${this.spanId}-${this.traceFlags}`;
  }

  createChildSpan(): TraceContext {
    return new TraceContext(this.traceId, crypto.randomBytes(8).toString('hex'), this.traceFlags);
  }

  static fromTraceParent(header: string): TraceContext | null {
    if (!header) return null;
    const parts = header.trim().split('-');
    if (parts.length !== 4) return null;

    const [version, traceId, spanId, traceFlags] = parts;
    if (version !== '00') return null;
    if (traceId.length !== 32 || spanId.length !== 16 || traceFlags.length !== 2) {
      return null;
    }

    return new TraceContext(traceId, spanId, traceFlags);
  }

  static create(sampled: boolean = true): TraceContext {
    return new TraceContext(undefined, undefined, sampled ? '01' : '00');
  }
}
