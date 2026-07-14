# Task Specification: TASKFLOW-DEF-011 — ApiKeyManager allows unauthorized tenant access due to missing role permission check

## Category
**Security and authorization defects**

## Target Source File
`src/security/auth/ApiKeyManager.ts`

## Problem Statement & Description
Role check validates read permissions for write operations (e.g. read-only key allowed to create tasks).

## Failure Impact
Unauthorized tenants perform destructive or state-modifying operations.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/unit/ApiKeyManager.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/unit/TenantQuotaManager.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
