# Task Specification: TASKFLOW-DEF-009 — DAGValidator fails to detect cyclic dependencies in workflow steps

## Category
**Workflow DAG and scheduling errors**

## Target Source File
`src/workflows/dag/DAGValidator.ts`

## Problem Statement & Description
Topological sort does not report error when in-degree reduction loop fails to resolve all nodes.

## Failure Impact
Workflow execution hangs indefinitely waiting on unresolved cyclical dependencies.

## Verification Protocol
1. Verify reproduction with defect test:
   `npx jest tests/unit/DAGValidator.test.ts`
2. Verify preservation of non-regressing behaviors:
   `npx jest tests/integration/WorkflowEngine.test.ts`
3. Verify full system build and test suite pass:
   `npm run lint && npm run build && npm test`
