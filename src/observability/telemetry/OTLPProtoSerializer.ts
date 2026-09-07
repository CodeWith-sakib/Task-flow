export interface SpanEvent {
  name: string;
  timeUnixNano: string;
  attributes?: Record<string, any>;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number; // 1 = INTERNAL, 2 = SERVER, 3 = CLIENT, 4 = PRODUCER, 5 = CONSUMER
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, any>;
  events?: SpanEvent[];
  status: { code: number; message?: string }; // 0 = UNSET, 1 = OK, 2 = ERROR
}

/**
 * OTLPProtoSerializer serializes distributed tracing spans into OpenTelemetry OTLP/JSON
 * format matching the OpenTelemetry specification (v1.0.0).
 */
export class OTLPProtoSerializer {
  public static serializeSpans(serviceName: string, spans: SpanData[]): any {
    const resourceAttributes = [
      { key: 'service.name', value: { stringValue: serviceName } },
      { key: 'telemetry.sdk.language', value: { stringValue: 'typescript' } },
      { key: 'telemetry.sdk.name', value: { stringValue: 'taskflow-engine' } }
    ];

    const formattedSpans = spans.map(span => ({
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId || undefined,
      name: span.name,
      kind: span.kind,
      startTimeUnixNano: span.startTimeUnixNano,
      endTimeUnixNano: span.endTimeUnixNano,
      attributes: this.formatAttributes(span.attributes),
      events: span.events?.map(e => ({
        name: e.name,
        timeUnixNano: e.timeUnixNano,
        attributes: e.attributes ? this.formatAttributes(e.attributes) : []
      })),
      status: span.status
    }));

    return {
      resourceSpans: [
        {
          resource: {
            attributes: resourceAttributes
          },
          scopeSpans: [
            {
              scope: {
                name: 'taskflow-tracer',
                version: '1.0.0'
              },
              spans: formattedSpans
            }
          ]
        }
      ]
    };
  }

  private static formatAttributes(attrs: Record<string, any>): { key: string; value: any }[] {
    return Object.entries(attrs).map(([key, val]) => {
      if (typeof val === 'string') {
        return { key, value: { stringValue: val } };
      }
      if (typeof val === 'number') {
        return Number.isInteger(val)
          ? { key, value: { intValue: String(val) } }
          : { key, value: { doubleValue: val } };
      }
      if (typeof val === 'boolean') {
        return { key, value: { boolValue: val } };
      }
      return { key, value: { stringValue: JSON.stringify(val) } };
    });
  }
}
