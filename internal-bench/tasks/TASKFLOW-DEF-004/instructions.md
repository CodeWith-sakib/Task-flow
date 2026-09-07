# Task Specification: TASKFLOW-DEF-004 — Lease fencing token fails to monotonically increment on lease renewal

## Category
**Concurrency and race conditions**

## Target Source File
`src/concurrency/lease/LeaseManager.ts`

## Problem Statement & Description
Re-acquiring an expired lease reuses the old fence token instead of incrementing, allowing split-brain zombie writes.

## Failure Impact
Downstream storage engines accept stale writes from timed-out workers.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/unit/LeaseManager.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/unit/LeaseAutoRenewer.test.ts`
   - `npx jest tests/integration/worker.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
