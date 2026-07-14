# Task Specification: TASKFLOW-DEF-020 — Default visibility timeout defaults to negative or zero milliseconds

## Category
**Configuration mistakes**

## Target Source File
`src/queue/visibility/VisibilityQueue.ts`

## Problem Statement & Description
Default visibility timeout set to 0ms instead of 30,000ms, causing immediate message redelivery.

## Failure Impact
Dequeued messages are instantly visible again, causing infinite reprocessing thrash.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/boundary/BoundaryConditions.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/unit/VisibilityQueue.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
