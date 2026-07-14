# Task Specification: TASKFLOW-DEF-006 — SecondaryIndex fails to clean old status index when a task status is updated

## Category
**Persistence and transaction bugs**

## Target Source File
`src/storage/index/SecondaryIndex.ts`

## Problem Statement & Description
Updating a task status leaves the task ID in the previous status set, resulting in ghost results.

## Failure Impact
Querying tasks by status returns tasks that are no longer in that status.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/unit/SecondaryIndex.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/boundary/BoundaryConditions.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
