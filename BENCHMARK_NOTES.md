# TaskFlow Engine — Benchmark & Industrial Hardening Notes

## Executive Overview
`TaskFlow-Engine` has been enhanced from an early 741-LOC incomplete prototype to a benchmark-grade, mission-critical distributed orchestration engine.

The engine provides:
- **Write-Ahead Log (WAL) Storage Engine**: Append-only log entries protected by CRC32 checksums, transactional isolation, point-in-time recovery, and background compaction.
- **Two-Phase Visibility Queue & DLQ**: SQS/RabbitMQ-style message visibility leases, automatic redelivery upon worker timeout, exponential backoff, and dead-letter queue routing upon max-delivery exhaustion.
- **Topological DAG Workflow Engine**: Cyclic dependency validation via Kahn's algorithm, execution tier batching for maximum parallelism, context propagation, and Saga rollback compensations.
- **Deterministic Cron Scheduler**: RFC-compliant cron parser with standard, step, range, and list fields, timezone-agnostic UTC arithmetic, and catch-up/skip misfire policies.
- **Distributed Concurrency Primitives**: Fencing tokens with monotonic epoch validation, token bucket rate limiters, and queue-depth adaptive worker pool autoscalers.
- **Hardened Webhook Dispatcher**: Cryptographic HMAC-SHA256 signature verification, jittered exponential backoff, and circuit breakers preventing cascaded endpoint failure.
- **Observability Stack**: Prometheus metrics registry exporting native text format, W3C Distributed TraceContext propagation (`traceparent`), and structured JSON logging with correlation IDs.
- **Security & Multi-Tenancy**: ApiKey authentication with granular role-based access control (Admin, Operator, ReadOnly), and tenant quota management (concurrency & throughput caps).
- **Embedded Ops Dashboard**: Self-contained HTML status dashboard and diagnostic CLI tool (`taskflow`).

---

## Benchmark Suite Architecture

### Defect Distribution
The benchmark catalog (`internal-bench/defects.yaml`) defines 28 engineered defects spanning all 12 target categories:
1. **State machine violations**: Transitions skipping prerequisite states or resurrections from terminal states.
2. **Concurrency & race conditions**: Double dequeues, lease fencing token re-use, unreleased worker mutexes.
3. **Persistence & transaction bugs**: CRC32 validation skips, secondary index desynchronization, WAL snapshot compaction data drops.
4. **Queue & stream processing errors**: DLQ routing bypasses, inverted priority sorting.
5. **Workflow DAG & scheduling errors**: Failure to detect cycles in step graphs, dropped Saga rollback compensations, false conditional branch failures.
6. **Security & authorization defects**: Missing role permission enforcement, compromised HMAC webhook signatures, quota bypasses.
7. **Observability & tracing breaks**: W3C parent span ID dropping, NaN histogram bucket corruption.
8. **Performance & backpressure regressions**: Token bucket overflow on long idles, autoscaler zero-concurrency collapse.
9. **Lifecycle bugs**: Unclean worker shutdown dropping in-flight tasks, scheduler ticks during terminated state.
10. **Configuration mistakes**: Environment variable parsing failures (`NaN` worker concurrency), negative visibility timeouts.
11. **Validation gaps**: Negative priority / retry acceptance, invalid cron month values accepted.
12. **Memory/resource leaks**: Detached event listener accumulation on task churn.

### Sand-Style Task Packaging
Each defect in `internal-bench/tasks/<TASKFLOW-DEF-XXX>` contains:
- `instructions.md`: Unambiguous problem statement, affected source files, failure impact, and verification commands.
- `task.json`: Machine-readable metadata pairing the defect to specific `[F2P]` (Fail-to-Pass) and `[P2P]` (Pass-to-Pass) test suites.

---

## Verification & Clean Baseline Guarantee

The golden baseline (`v1.0.0-golden`) passes 100% of test suites with zero failures and zero compiler or linter warnings:
- **Test Suites**: 31 suites passed (115 unit, integration, boundary, e2e, error-handling, fuzz, and persistence tests).
- **TypeScript Gate**: Zero compiler errors (`tsc --noEmit` & `tsc`).
- **Determinism**: 100% in-memory simulator and mocked socket layer guaranteeing zero reliance on external network ports or wall-clock races.
