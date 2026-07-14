# Task Specification: TASKFLOW-DEF-005 — Corrupted WAL record replay passes validation when CRC32 checksum verification is skipped

## Category
**Persistence and transaction bugs**

## Target Source File
`src/storage/wal/WALStorageEngine.ts`

## Problem Statement & Description
Replaying WAL log skips CRC32 checksum check, deserializing truncated and corrupted bytes.

## Failure Impact
Silent state corruption and invalid task structures restored after crash.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/persistence/WALStorageEngine.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/unit/WALDatabaseAdapter.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
