# Task Specification: TASKFLOW-DEF-014 — MetricsRegistry histogram bucketing records NaN when negative latency values occur

## Category
**Observability and tracing breaks**

## Target Source File
`src/observability/metrics/MetricsRegistry.ts`

## Problem Statement & Description
Histogram observeHistogram does not validate duration >= 0, corrupting metric output.

## Failure Impact
Prometheus scraper fails to parse metrics endpoint due to NaN bucket counts.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/unit/MetricsRegistry.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/e2e/FullSystemE2E.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
