# Task Specification: TASKFLOW-DEF-028 — WALStorageEngine snapshot compaction deletes active tasks not present in checkpoint

## Category
**Persistence and transaction bugs**

## Target Source File
`src/storage/wal/WALStorageEngine.ts`

## Problem Statement & Description
Compaction overwrites task index with snapshot state before flushing remaining log tail.

## Failure Impact
Recently created tasks between checkpoint and compaction are silently lost.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/persistence/WALStorageEngine.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/unit/WALDatabaseAdapter.test.ts`
   - `npx jest tests/unit/RecoveryJournal.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
