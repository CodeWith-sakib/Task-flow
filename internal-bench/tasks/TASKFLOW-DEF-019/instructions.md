# Task Specification: TASKFLOW-DEF-019 — Environment variable WORKER_CONCURRENCY parsed as string or NaN causes zero worker threads

## Category
**Configuration mistakes**

## Target Source File
`src/index.ts`

## Problem Statement & Description
Application parses parseInt(process.env.WORKER_CONCURRENCY) without fallback when invalid string is passed.

## Failure Impact
Worker pool starts with NaN concurrency, refusing to process any dequeued tasks.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/e2e/FullSystemE2E.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/api/TaskEndpoints.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
