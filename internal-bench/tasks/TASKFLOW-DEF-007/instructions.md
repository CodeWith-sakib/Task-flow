# Task Specification: TASKFLOW-DEF-007 — DeadLetterQueue routes poisoned tasks to main queue instead of DLQ on max delivery exhaustion

## Category
**Queue and stream processing errors**

## Target Source File
`src/queue/visibility/VisibilityQueue.ts`

## Problem Statement & Description
When deliveryCount reaches maxDeliveries, NACK re-enqueues rather than routing to DLQ.

## Failure Impact
Poison pills cause infinite retry loops exhausting worker resources.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/boundary/BoundaryConditions.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/unit/VisibilityQueue.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
