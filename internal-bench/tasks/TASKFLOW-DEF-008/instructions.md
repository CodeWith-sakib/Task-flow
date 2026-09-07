# Task Specification: TASKFLOW-DEF-008 — VisibilityQueue priority sorting inverted: lower priority tasks dequeued ahead of critical tasks

## Category
**Queue and stream processing errors**

## Target Source File
`src/queue/visibility/VisibilityQueue.ts`

## Problem Statement & Description
Sorting sorts ascending by priority instead of descending.

## Failure Impact
Critical priority tasks starve behind low-priority batch jobs.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/unit/VisibilityQueue.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/boundary/BoundaryConditions.test.ts`
   - `npx jest tests/unit/PriorityHeap.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
