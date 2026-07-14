# Task Specification: TASKFLOW-DEF-016 — WorkerPoolAutoscaler scales down to 0 concurrency even when queue depth exceeds threshold

## Category
**Performance and backpressure regressions**

## Target Source File
`src/concurrency/pool/WorkerPoolAutoscaler.ts`

## Problem Statement & Description
Autoscaler math evaluates target concurrency to zero instead of clamping to minConcurrency.

## Failure Impact
Worker pool completely stops processing tasks during high queue pressure.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/boundary/BoundaryConditions.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/integration/worker.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
