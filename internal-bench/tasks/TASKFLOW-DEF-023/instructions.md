# Task Specification: TASKFLOW-DEF-023 — EventEmitter fails to remove listeners in off() method, causing unbounded listener accumulation

## Category
**Memory/resource leaks**

## Target Source File
`src/events/EventEmitter.ts`

## Problem Statement & Description
off() method looks up handler by reference using incorrect index calculation, leaving listeners active.

## Failure Impact
Node.js MaxListenersExceededWarning and memory leak under high task churn.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/error/SystemErrorHandling.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/integration/lifecycle.test.ts`
   - `npx jest tests/unit/EventStore.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
