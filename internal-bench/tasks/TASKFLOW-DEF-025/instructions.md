# Task Specification: TASKFLOW-DEF-025 — Workflow step with failed condition filter ('when' clause) causes entire workflow to fail

## Category
**Workflow DAG and scheduling errors**

## Target Source File
`src/workflows/WorkflowEngine.ts`

## Problem Statement & Description
A step whose 'when' conditional evaluates to false should be skipped, but instead marks step as FAILED.

## Failure Impact
Conditional branch workflows cannot skip optional steps without failing the parent workflow.

## Verification Protocol
1. Verify reproduction with defect test (F2P):
   - `npx jest tests/integration/WorkflowEngine.test.ts`
2. Verify preservation of non-regressing behaviors (P2P):
   - `npx jest tests/unit/DAGValidator.test.ts`
   - `npx jest tests/unit/DynamicTaskGraphEvaluator.test.ts`
3. Verify full system build and test suite pass:
   - `npm run lint && npm run build && npm test`
