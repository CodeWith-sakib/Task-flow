# Task Specification: TASKFLOW-DEF-026 — WorkerLock release fails to notify queued waiters when lock holder errors out

## Category
**Concurrency and race conditions**

## Target Source File
`src/workers/Worker.ts`

## Problem Statement & Description
When task execution throws an exception, lock release hook is bypassed, causing deadlock.

## Failure Impact
Worker permanently locks up after the first encountered task failure.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/integration/worker.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/integration/lifecycle.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
