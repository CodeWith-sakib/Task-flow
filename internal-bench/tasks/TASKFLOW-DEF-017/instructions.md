# Task Specification: TASKFLOW-DEF-017 — Worker stop() resolves immediately while active tasks are still processing

## Category
**Lifecycle bugs**

## Target Source File
`src/workers/Worker.ts`

## Problem Statement & Description
Graceful shutdown does not wait for in-flight tasks to complete before setting isRunning = false.

## Failure Impact
In-flight tasks are abruptly terminated or left in unacknowledged zombie state upon SIGTERM.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/integration/worker.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/integration/lifecycle.test.ts`
   - `npx jest tests/unit/GracefulShutdownCoordinator.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
