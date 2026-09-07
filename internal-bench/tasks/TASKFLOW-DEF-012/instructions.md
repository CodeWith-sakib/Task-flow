# Task Specification: TASKFLOW-DEF-012 — HMAC webhook signature computation uses hardcoded salt or skips payload bytes

## Category
**Security and authorization defects**

## Target Source File
`src/webhooks/crypto/hmac.ts`

## Problem Statement & Description
Signature generation signs empty string or omits secret key from HMAC-SHA256 digest.

## Failure Impact
Forged webhook payloads are accepted by downstream receivers.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/unit/WebhookHMAC.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/unit/WebhookDispatcher.test.ts`
   - `npx jest tests/unit/WebhookSignatureRotator.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
