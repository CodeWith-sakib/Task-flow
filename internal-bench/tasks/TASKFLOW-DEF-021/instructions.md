# Task Specification: TASKFLOW-DEF-021 — TaskService accepts negative maxRetries and negative priority values

## Category
**Validation gaps**

## Target Source File
`src/core/TaskService.ts`

## Problem Statement & Description
CreateTaskRequest payload validation fails to reject negative priority and retry limits.

## Failure Impact
Negative retries corrupt retry counter math and lead to immediate task drops.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/unit/TaskService.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/api/TaskEndpoints.test.ts`
   - `npx jest tests/unit/SchemaValidator.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
