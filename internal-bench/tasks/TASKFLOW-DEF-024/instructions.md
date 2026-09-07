# Task Specification: TASKFLOW-DEF-024 — Task retry count not incremented when moving from RUNNING back to RETRYING

## Category
**State machine violations**

## Target Source File
`src/core/TaskService.ts`

## Problem Statement & Description
StateTransitioner allows retry transition without bumping retryCount in task record.

## Failure Impact
Tasks retry indefinitely, ignoring maxRetries limits.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/unit/RetryManager.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/integration/lifecycle.test.ts`
   - `npx jest tests/unit/TaskService.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
