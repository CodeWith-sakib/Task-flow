# Task Specification: TASKFLOW-DEF-003 — Double dequeue race condition in VisibilityQueue during concurrent dequeue calls

## Category
**Concurrency and race conditions**

## Target Source File
`src/queue/visibility/VisibilityQueue.ts`

## Problem Statement & Description
Concurrent workers pop the same item before visibleAfter timestamp update is written.

## Failure Impact
Multiple workers execute the same task concurrently, causing duplicate side effects.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/boundary/BoundaryConditions.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/unit/VisibilityQueue.test.ts`
   - `npx jest tests/integration/worker.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
