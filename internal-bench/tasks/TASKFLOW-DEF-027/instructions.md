# Task Specification: TASKFLOW-DEF-027 — TenantQuotaManager allows tenant to exceed maxConcurrentTasks quota

## Category
**Security and authorization defects**

## Target Source File
`src/security/tenant/TenantQuotaManager.ts`

## Problem Statement & Description
Quota check checks > instead of >= against maxConcurrentTasks.

## Failure Impact
Tenants exceed provisioned resource limits, causing noisy-neighbor degradation.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/unit/TenantQuotaManager.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/unit/ApiKeyManager.test.ts`
   - `npx jest tests/unit/ScopedRBACOperator.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
