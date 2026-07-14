# Task Specification: TASKFLOW-DEF-002 — Terminal FAILED state incorrectly permits transition back to RUNNING

## Category
**State machine violations**

## Target Source File
`src/core/state/StateTransitioner.ts`

## Problem Statement & Description
Once a task exhausts retries and enters FAILED, it must be terminal unless explicitly resurrected via replay.

## Failure Impact
Violates state machine invariants and causes zombie worker executions.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/error/SystemErrorHandling.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/unit/TaskService.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
