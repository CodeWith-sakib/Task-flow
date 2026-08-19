# Changelog

All notable changes to the `TaskFlow-Engine` project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-07

### Added
- **Storage Subsystem**:
  - `WALStorageEngine`: Binary CRC32 checksums, append-only write-ahead logging, crash replay recovery, and snapshot compaction.
  - `SecondaryIndex`: Multi-index inverted table supporting query by status, task type, and priority ranges.
  - `WALDatabaseAdapter`: Bridge adapting WAL storage engine to the core `IDatabase` interface.
- **Queuing & Reliability**:
  - `VisibilityQueue`: Two-phase message locking with ACK/NACK semantics and configurable visibility timeouts.
  - `DeadLetterQueue`: Poison-pill routing with inspection, purge, and replay APIs.
- **Workflow & Orchestration Engine**:
  - `DAGValidator`: Cyclic dependency detection and topological execution tier batching using Kahn's algorithm.
  - `WorkflowEngine`: Multi-step DAG workflows with cross-step context propagation, parallel tier execution, conditional step execution, and Saga rollback compensations.
- **Scheduling**:
  - `CronParser`: RFC-compliant 5-field parser supporting wildcards, ranges, steps, and lists in deterministic UTC.
  - `CronScheduler`: Periodic job scheduling with configurable misfire recovery policies.
- **Concurrency & Scaling**:
  - `LeaseManager`: Distributed mutual exclusion with monotonic epoch fencing tokens.
  - `TokenBucketRateLimiter`: High-throughput token bucket traffic shaping.
  - `WorkerPoolAutoscaler`: Dynamic concurrency adjustment based on queue latency and worker metrics.
- **Webhooks & Resilience**:
  - `WebhookDispatcher`: Reliable webhook delivery with HMAC-SHA256 signature verification.
  - `CircuitBreaker`: Cooldown and half-open state transitions for third-party endpoints.
- **Observability**:
  - `MetricsRegistry`: Prometheus metrics exposition (`/metrics`).
  - `TraceContext`: W3C distributed trace context propagation.
  - `StructuredLogger`: JSON logging with correlation IDs.
  - `StatusDashboard`: Operational HTML dashboard (`/status`).
- **Security & Multi-Tenancy**:
  - `ApiKeyManager`: Role-based access control with token authentication.
  - `TenantQuotaManager`: Tenant-level concurrency and throughput quotas.
- **CLI & Tooling**:
  - `TaskFlowCLI`: Diagnostic and task inspection CLI.
- **Defect Benchmark**:
  - `internal-bench/defects.yaml`: 28 cataloged real-world engineering defects across 12 distinct categories.
  - `internal-bench/tasks/`: Sand-style task packages with individual `instructions.md` and `task.json`.
- **Comprehensive Test Suite**:
  - 31 test suites comprising 115 tests covering unit, integration, API, boundary, fuzz, error-handling, and end-to-end paths.

### Fixed
- Stabilized task status transitions and type definitions.
- Resolved worker lock resolution typing and active counter lifecycle leaks.
- Fixed timer leaks in worker task timeout execution.
