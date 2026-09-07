# Task Specification: TASKFLOW-DEF-013 — TraceContext parent span ID dropped during asynchronous context propagation

## Category
**Observability and tracing breaks**

## Target Source File
`src/observability/tracing/TraceContext.ts`

## Problem Statement & Description
Trace headers serialize traceparent without the parentSpanId field or zero-pads incorrectly.

## Failure Impact
Distributed traces are broken; child spans appear as root spans.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/unit/TraceContext.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/unit/MetricsRegistry.test.ts`
   - `npx jest tests/unit/SpanExporter.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
