import * as crypto from 'crypto';

export interface TraceContextData {
  traceId: string;
  spanId: string;
  sampled: boolean;
  traceState?: Record<string, string>;
}

/**
 * W3CTraceContext serializes and parses W3C Trace Context headers (traceparent and tracestate)
 * according to W3C recommendation specification.
 */
export class W3CTraceContext {
  public static parse(traceParent?: string, traceState?: string): TraceContextData {
    if (!traceParent) {
      return this.generateNew();
    }

    const parts = traceParent.trim().split('-');
    if (parts.length !== 4) {
      return this.generateNew();
    }

    const [version, traceId, spanId, flags] = parts;
    if (version !== '00' || traceId.length !== 32 || spanId.length !== 16 || flags.length !== 2) {
      return this.generateNew();
    }

    const sampled = (parseInt(flags, 16) & 0x01) === 0x01;
    const parsedState: Record<string, string> = {};

    if (traceState) {
      const entries = traceState.split(',');
      for (const entry of entries) {
        const [k, v] = entry.trim().split('=');
        if (k && v) {
          parsedState[k] = v;
        }
      }
    }

    return {
      traceId,
      spanId,
      sampled,
      traceState: parsedState
    };
  }

  public static format(ctx: TraceContextData): { traceparent: string; tracestate?: string } {
    const flags = ctx.sampled ? '01' : '00';
    const traceparent = `00-${ctx.traceId}-${ctx.spanId}-${flags}`;

    let tracestate: string | undefined;
    if (ctx.traceState && Object.keys(ctx.traceState).length > 0) {
      tracestate = Object.entries(ctx.traceState)
        .map(([k, v]) => `${k}=${v}`)
        .join(',');
    }

    return { traceparent, tracestate };
  }

  public static generateNew(sampled: boolean = true): TraceContextData {
    return {
      traceId: crypto.randomBytes(16).toString('hex'),
      spanId: crypto.randomBytes(8).toString('hex'),
      sampled,
      traceState: {}
    };
  }
}
