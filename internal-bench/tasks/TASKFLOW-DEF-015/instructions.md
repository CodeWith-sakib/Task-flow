# Task Specification: TASKFLOW-DEF-015 — TokenBucketRateLimiter refills tokens on elapsed time calculation without floor bounds

## Category
**Performance and backpressure regressions**

## Target Source File
`src/concurrency/limiter/TokenBucketRateLimiter.ts`

## Problem Statement & Description
Token refilling allows tokens to exceed bucket capacity when burst arrives after long idle period.

## Failure Impact
Unbounded burst traffic overwhelms worker queues and breaches upstream rate limits.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/unit/TokenBucketRateLimiter.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/boundary/BoundaryConditions.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
