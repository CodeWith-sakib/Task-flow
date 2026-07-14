# Task Specification: TASKFLOW-DEF-001 — Permit invalid transition from PENDING directly to SUCCESS

## Category
**State machine violations**

## Target Source File
`src/core/state/StateTransitioner.ts`

## Problem Statement & Description
Allowing a task to skip QUEUED and RUNNING directly into SUCCESS violates transactional safety.

## Failure Impact
Tasks bypass queuing and worker execution while appearing finished.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/error/SystemErrorHandling.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/unit/TaskService.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
