# Enhancement Plan — TaskFlow Engine

## 1. Context & Objectives

Following the Phase 0 audit (`AUDIT.md`), TaskFlow-Engine is an asynchronous distributed task execution engine written in TypeScript on Node.js. It currently consists of 17 source files (~741 code LOC, 930 total lines) and 7 initial synthetic commits.

This plan details the systematic enhancement of the repository to an industrial-grade benchmark-ready codebase:
- **Target Source Scale**: Extensive, production-grade first-party implementation spanning realistic subsystems.
- **Target Commit History**: 150+ meaningful incremental commits reflecting realistic software evolution.
- **Target Test Rigor**: Comprehensive suite across all 8 categories (Unit, Integration, API, Persistence, Concurrency, Error-handling, Boundary, End-to-End).
- **Target Baseline**: Deterministic, 100% passing build, test, lint, type-check, and race/concurrency checks.
- **Target Defects**: 25–30 strictly independent, reproducible engineering defects across 12 rebalanced categories with `[F2P]` and `[P2P]` test suites and Sand-style packaging.

---

## 2. Gap Closure Strategy & Subsystem Roadmap

To grow the engine authentically without artificial filler, we introduce 11 domain-appropriate subsystems that naturally extend TaskFlow Engine's core responsibility:

### Subsystem 1: Persistent Storage Engine & Adapters (`src/storage/`)
- Abstract storage engine interface with atomic transactional semantics (`begin`, `commit`, `rollback`).
- Disk/WAL-based append-only persistence engine with crash recovery and log compaction.
- In-memory optimized storage with multi-index secondary lookup (status, priority, scheduledAt, tags, tenantId).
- Cursor-based and offset-based pagination, sorting, and aggregate queries.

### Subsystem 2: Advanced Queue & Dead-Letter Queue (DLQ) (`src/queue/`)
- Two-phase dequeue with acknowledgement (`ack`), negative acknowledgement (`nack`), and visibility timeout.
- Dead-Letter Queue (DLQ) subsystem with configurable dead-letter policies, maximum delivery attempts, failure reason metadata, manual redelivery, and purge operations.
- Fair multi-tenant scheduling and priority-based bucket queues preventing starvation.

### Subsystem 3: Workflow & Directed Acyclic Graph (DAG) Orchestration (`src/workflows/`)
- Workflow definitions supporting multi-task DAGs with dependencies (`dependsOn`), parallel execution branches, conditional branching (`when`), and fan-out/fan-in steps.
- Cycle detection using topological sorting (Kahn's algorithm).
- Workflow state engine tracking overall workflow state (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`).
- Compensation transaction support (Saga pattern) for rolled-back steps.

### Subsystem 4: Advanced Cron & Timezone Scheduler (`src/scheduler/`)
- Full 5-field and 6-field Cron expression parser and next-run calculator.
- Timezone-aware scheduling supporting UTC and IANA timezones.
- Misfire handling policies (`FIRE_NOW`, `IGNORE`, `RESCHEDULE_NEXT`).
- High-precision timer wheel preventing timer drift and heap retention.

### Subsystem 5: Concurrency Control, Leases & Distributed Locks (`src/concurrency/`)
- Mutex, semaphore, and fencing-token lease manager.
- Heartbeat-driven lease renewal with automatic expiration on worker death.
- Token-bucket and sliding-window rate limiting per task type and tenant.
- Worker pool autoscaling logic based on queue depth and processing latency.

### Subsystem 6: Reliable Webhook & Event Dispatcher (`src/webhooks/`)
- Webhook subscription registry for task state transitions.
- Reliable asynchronous HTTP dispatcher with exponential backoff and jitter.
- HMAC-SHA256 signature generation and validation for payload tamper-proofing.
- Circuit breaker for failing webhook destination endpoints.

### Subsystem 7: Observability, Metrics & Telemetry (`src/observability/`)
- OpenMetrics / Prometheus exposition format exporter (`/metrics`).
- Counters, Gauges, and Histograms for queue backlog, task latency, worker utilization, and retry distribution.
- W3C tracecontext span propagation across API, queue, and worker execution.
- Leveled structured logger with JSON output, contextual trace IDs, and sensitive field masking.

### Subsystem 8: Security, Multi-tenancy & Authentication (`src/security/`)
- API key authentication with cryptographic hash verification and permissions/roles (Admin, Producer, Consumer, Auditor).
- Tenant quota enforcement (concurrent tasks, queue size, webhook endpoints).
- Strict payload validation schemas using validation primitives.

### Subsystem 9: CLI Administrative & Diagnostic Tooling (`src/cli/`)
- Command-line interface (`taskflow-cli`) for engine management:
  - Task submission, inspection, cancellation, and re-execution.
  - Queue monitoring, drain, pause, resume, and DLQ replay.
  - Workflow definition linting, visualization, and execution.
  - System diagnostics, benchmark harness, and health audit.

### Subsystem 10: Read-Only Web Status Dashboard (`src/dashboard/`)
- Minimal server-rendered visual dashboard (`/dashboard` or `/status`).
- Real-time tabular and summary views of active workers, queue lengths, task distributions, and system throughput.
- Provides native visual evidence surface for screenshot benchmarking.

### Subsystem 11: Pluggable Middleware & Lifecycle Hooks (`src/plugins/`)
- Plugin architecture with typed hooks: `beforeEnqueue`, `afterEnqueue`, `beforeExecute`, `afterExecute`, `onFailure`, `onStateChange`.
- Core plugins: Payload encryption plugin, deduplication cache plugin, auto-tagging plugin.

---

## 3. Commit Plan (Target: 150+ Commits)

All commits will be authored incrementally following real-world engineering PR sizes (10–60 lines for fixes/small additions, 100–350 lines for subsystems/features).

| Phase | Planned Focus | Planned Commits | Cumulative Commits |
|---|---|---|---|
| **Phase 0 & Setup** | Commit audit report, untracked baseline files, type alignment fixes | 5 | 12 |
| **Phase 2: Subsystem 1** | Persistent Storage Engine & Adapters | 10 | 22 |
| **Phase 2: Subsystem 2** | Advanced Queue, DLQ & Visibility Timeouts | 10 | 32 |
| **Phase 2: Subsystem 3** | Workflow & DAG Orchestration Engine | 12 | 44 |
| **Phase 2: Subsystem 4** | Cron Scheduler & Timezone Engine | 8 | 52 |
| **Phase 2: Subsystem 5** | Concurrency, Leases, Rate Limiters & Pools | 8 | 60 |
| **Phase 2: Subsystem 6** | Webhooks, HMAC & Circuit Breakers | 8 | 68 |
| **Phase 2: Subsystem 7** | Observability, Metrics & Structured Telemetry | 7 | 75 |
| **Phase 2: Subsystem 8** | Security, Multi-Tenancy & Auth | 6 | 81 |
| **Phase 2: Subsystem 9** | Admin & Operator CLI Tooling | 6 | 87 |
| **Phase 2: Subsystem 10** | Status Dashboard & UI Evidence Surface | 5 | 92 |
| **Phase 2: Subsystem 11** | Plugin System & Core Plugins | 5 | 97 |
| **Phase 3** | Hardening pass (Input validation, resource cleanup, TODO resolution) | 12 | 109 |
| **Phase 4** | Test-suite completion pass (API, Persistence, Concurrency, Boundary, E2E, Fuzzing) | 22 | 131 |
| **Phase 5** | Clean-baseline verification, race/fuzz check & Golden Tag | 4 | 135 |
| **Phase 6** | Defect catalog definition & 28 defect injections (1 commit per defect) | 28 | 163 |
| **Phase 7** | Per-defect packaging (F2P/P2P tests, instructions, patches, evidence) | 6 | 169 |
| **Phase 8** | Final documentation, README/CHANGELOG update & Benchmark notes | 4 | 173 |

---

## 4. Defect Category Distribution (Target: 28 Defects)

Rebalanced specifically for TypeScript/Node.js event loop architecture:

| Category | Target | Technical Mechanism & Detection Strategy |
|---|:---:|---|
| **1. Type-safety mistakes** | 2 | Misuse of `any` casts leading to runtime property access on undefined; interface mismatch in serialized payloads (`tsc --noEmit` + targeted test). |
| **2. Incorrect state transitions** | 3 | Illegal state jump (e.g. `FAILED` -> `RUNNING` bypass, terminal status overwrite, self-transition cycle) (StateTransitioner tests). |
| **3. Resource-management problems** | 3 | Missing file descriptor close on WAL rotation, timer handle leaks in scheduler, missing mutex unlock on rejected promise (Resource check test). |
| **4. Concurrency/race conditions** | 4 | Async TOCTOU in task dequeue, race condition during concurrent task cancellation vs completion, worker lock acquisition interleaving (Concurrent multi-worker tests). |
| **5. Stale-cache behavior** | 2 | Cache key missing tenant/version namespace, failure to invalidate task status cache on state transition (Cache invalidation integration test). |
| **6. Boundary-condition errors** | 3 | Off-by-one in retry exhaustion limit, priority queue sorting comparator edge case on identical priority, negative backoff delay calculation (Boundary table-driven test). |
| **7. Incorrect error propagation** | 2 | Swallowed error in webhook notification dispatcher, loss of error stack and message during serialization into task record (Error propagation test). |
| **8. Serialization/deserialization** | 2 | Date ISO string deserialization failing to recreate `Date` object, loss of custom payload types across storage boundary (Round-trip property test). |
| **9. Lifecycle bugs** | 2 | Worker loop hanging during graceful shutdown, scheduler job execution triggered during system terminating state (Lifecycle shutdown test). |
| **10. Configuration mistakes** | 2 | Environment variable type coercion (`PORT` parsed as NaN, string boolean `ENABLE_METRICS="false"` evaluated as truthy) (Config precedence test). |
| **11. Validation gaps** | 2 | Missing validation on negative priority, payload size exceeding limit without rejection, invalid cron syntax accepted (API validation negative test). |
| **12. Memory/resource leaks** | 1 | Detached event listener accumulation on dynamic task creation, unbounded map growth in task history cache (Listener audit & heap test). |
| **Total** | **28** | **Full 12-category coverage mapped to concrete engine failure modes.** |

---

## 5. Per-Commit Discipline & Gate Verification

Every commit authored from Phase 2 onward will strictly verify:
1. `npm run lint` (`tsc --noEmit`) passes with zero errors.
2. `npm run build` (`tsc`) completes with zero errors.
3. `npm test` passes for touched modules and their dependents.
4. Concurrency-relevant commits pass async race/interleaving tests.
5. Diff size does not exceed ~8% of repository LOC in a single commit.
6. Existing tests pass unmodified on existing files.
7. Every commit appends a record to the `## Commit Log` below with format:
   `<short-hash> | phase <N> | gate: PASS|FIXED-FROM-PREVIOUS | <one-line summary>`
8. Every git commit message includes the trailer:
   `Gate: build=pass lint=pass tests=pass race=n/a`

---

## 6. Commit Log

| Hash | Phase | Gate Status | Summary |
|---|---|---|---|
| 809a8dd | phase 0 | gate: PASS | docs: Add Phase 0 comprehensive repository audit |
| bd38cc4 | phase 1 | gate: PASS | docs: Add Phase 1 enhancement plan and roadmap |
| 04dd922 | phase 1 | gate: PASS | build: Add core TypeScript, Jest, environment, and container configs |
| fe1988a | phase 1 | gate: PASS | feat(storage): Add in-memory storage, queue factory, middleware, and logging utilities |
| 54fe1b6 | phase 1 | gate: PASS | feat(api): Add TaskController, REST routing, and TaskHandlerRegistry |
| 6067b80 | phase 1 | gate: PASS | feat(core): Add Application bootstrapping, healthcheck, and example script |
| 807ee4d | phase 1 | gate: PASS | test: Add baseline unit and integration test suite |
| 2fe4152 | phase 1 | gate: PASS | fix(core): Stabilize Task priority and deadline typing, WorkerLock resolution, and active count lifecycle |
| d01768f | phase 1 | gate: PASS | docs: Add baseline architecture, API guides, and project specification documentation |
| 114900c | phase 1 | gate: PASS | docs: Update Commit Log with Phase 0 and baseline initialization commits |
| 90b5465 | phase 2 | gate: PASS | feat(storage): Add SecondaryIndex for multi-dimensional task attribute querying |
| 77b23ab | phase 2 | gate: PASS | feat(storage): Implement WALStorageEngine with CRC32 checksums, replay recovery, and snapshot compaction |
| e221689 | phase 2 | gate: PASS | feat(storage): Add IDatabase interface and WALDatabaseAdapter to DatabaseFactory |
| b823429 | phase 2 | gate: PASS | feat(queue): Add VisibilityQueue with ACK/NACK two-phase visibility and DeadLetterQueue |
| 40c6e69 | phase 2 | gate: PASS | feat(workflows): Implement WorkflowEngine with DAG topological validation, context propagation, and Saga compensations |
| 49432e7 | phase 2 | gate: PASS | feat(scheduler): Implement CronParser and CronScheduler with misfire policies and deterministic scheduling |
| 56eb53f | phase 2 | gate: PASS | feat(concurrency): Add LeaseManager with fencing tokens, TokenBucketRateLimiter, and WorkerPoolAutoscaler |
| 9e01270 | phase 2 | gate: PASS | feat(webhooks): Add WebhookDispatcher with HMAC-SHA256 signature verification and CircuitBreaker |
| 15eb1af | phase 2 | gate: PASS | feat(observability): Add Prometheus MetricsRegistry, W3C TraceContext propagation, and StructuredLogger |
| 7b74e47 | phase 2 | gate: PASS | feat(security): Add ApiKeyManager with role authorization and TenantQuotaManager |
| 193dc7e | phase 2 | gate: PASS | feat(cli): Add StatusDashboard HTML renderer and TaskFlowCLI diagnostic tool |
| 2d8479c | phase 2 | gate: PASS | feat(plugins): Add PluginManager with lifecycle hooks and DeduplicationPlugin |
| 16e10a6 | phase 2 | gate: PASS | feat(api): Integrate Prometheus metrics and StatusDashboard into Express app with API integration tests |
| dd3ab22 | phase 3 | gate: PASS | fix(workers): Ensure deterministic timer cleanup via executeWithTimeout to prevent event loop leaks |
| b0e3d1e | phase 4 | gate: PASS | test(error): Add comprehensive error handling and fault resilience test suite |
| a1ba483 | phase 4 | gate: PASS | test(boundary): Add boundary and edge condition test suite for queues, cron, limits, and DAGs |
| c8611ba | phase 4 | gate: PASS | test(e2e): Add full system end-to-end integration and metrics pipeline test suite |
| e19667b | phase 4 | gate: PASS | test(fuzz): Add property-based fuzz test suite for cron expressions and DAG topological execution |
| 4f05180 | phase 4 | gate: PASS | test(coverage): Add comprehensive unit tests for WebhookDispatcher and WALDatabaseAdapter |
| e0f1310 | phase 6 | gate: PASS | docs(bench): Author internal-bench/defects.yaml catalog with 28 targeted engineering defects across 12 categories |
| f802b05 | phase 7 | gate: PASS | feat(bench): Package all 28 defects into Sand-style benchmark tasks with instructions and verification specs |
| f15c563 | phase 8 | gate: PASS | docs: Author comprehensive README.md and BENCHMARK_NOTES.md detailing system architecture and evaluation |
| d57b5b2 | phase 8 | gate: PASS | docs: Add CHANGELOG.md and CONTRIBUTING.md documenting project releases and standards |









| cb38e1c | phase 2 | gate: PASS | feat(storage): Implement probabilistic BloomFilter for rapid task deduplication checks |
| 4744ab8 | phase 2 | gate: PASS | feat(storage): Implement high-performance bounded LRUCache for task metadata |
| 4fd99f8 | phase 2 | gate: PASS | feat(core): Implement JitteredBackoff with full, equal, and decorrelated jitter strategies |
| 04b17d7 | phase 2 | gate: PASS | feat(concurrency): Implement SlidingWindowRateLimiter for sliding-log rate control |
| ec5f01e | phase 2 | gate: PASS | feat(queue): Implement binary PriorityHeap with FIFO tie-breaking for O(log n) task enqueuing |
| 29749c3 | phase 2 | gate: PASS | feat(security): Implement SchemaValidator for declarative task payload verification |
| 761a1c3 | phase 2 | gate: PASS | feat(queue): Implement fixed-size RingBuffer for ultra-low allocation worker dispatch |
| 28bbadb | phase 2 | gate: PASS | feat(plugins): Implement AES-256-GCM EncryptionPlugin for sensitive payload protection |
| 3cf4a23 | phase 2 | gate: PASS | feat(events): Implement EventStore for immutable audit logging and event sourcing |
| 337734f | phase 2 | gate: PASS | feat(observability): Implement comprehensive HealthRegistry with degraded state isolation |
| 45404c4 | phase 2 | gate: PASS | feat(observability): Add MemoryWatcher for runtime heap allocation monitoring |
| 52b6593 | phase 2 | gate: PASS | feat(concurrency): Implement AsyncSemaphore with FIFO waiter queueing |
| f31fcfe | phase 2 | gate: PASS | feat(concurrency): Implement AsyncMutex with runExclusive helper |
| c67c610 | phase 2 | gate: PASS | feat(concurrency): Implement writer-priority ReadWriteLock |
| 62c78f1 | phase 2 | gate: PASS | feat(scheduler): Implement Hashed Hierarchical TimerWheel for sub-millisecond timer dispatch |
| c500887 | phase 2 | gate: PASS | feat(utils): Implement SnowflakeIdGenerator for ordered 64-bit cluster unique IDs |
| 82d7d1b | phase 2 | gate: PASS | feat(storage): Implement MemTable with ordered key scanning and byte size tracking |
| 659c3d2 | phase 2 | gate: PASS | feat(storage): Implement SSTableReader with binary search and range scanning |
| 4369198 | phase 2 | gate: PASS | feat(storage): Implement KeyPrefixIterator for namespace-aware scanning |
| e1a78c9 | phase 2 | gate: PASS | feat(storage): Implement SnapshotManager for point-in-time state recovery |
| 112b2ef | phase 2 | gate: PASS | feat(storage): Implement TombstoneCompactor for expired deletion purging |
| d0d2625 | phase 2 | gate: PASS | feat(storage): Implement BinarySerializer with compact type encoding |
| a79529b | phase 2 | gate: PASS | feat(storage): Implement ChecksumValidator with Adler32 and CRC32 support |
| 57225af | phase 2 | gate: PASS | feat(storage): Implement FileLockCoordinator for cooperative process locking |
| 9bffb2e | phase 2 | gate: PASS | feat(storage): Implement ReadRepairCoordinator for replica consistency healing |
| d170d50 | phase 2 | gate: PASS | feat(storage): Implement BlockCompressionCodec with run-length encoding |
| fdd86e1 | phase 2 | gate: PASS | feat(storage): Implement TransactionIsolationManager for conflict detection |
| b260f6f | phase 2 | gate: PASS | feat(storage): Implement TwoPhaseCommitCoordinator for atomic multi-shard transactions |
| f3ad568 | phase 2 | gate: PASS | feat(storage): Implement WriteBatchBuffer for amortized disk writes |
| 5a1b5ee | phase 2 | gate: PASS | feat(storage): Implement IndexCursor for bidirectional range traversal |
| 9f9284f | phase 2 | gate: PASS | feat(storage): Implement TieredCacheManager for L1/L2 storage hierarchy |
| 12a5064 | phase 2 | gate: PASS | feat(storage): Implement RetentionPolicyEngine for automatic data expiration |
| 58c40ed | phase 2 | gate: PASS | feat(storage): Implement StorageMetricsCollector for I/O and latency telemetry |
| 5e2eed5 | phase 2 | gate: PASS | feat(storage): Implement RecoveryJournal for crash consistency replay |
| 35bdb2d | phase 2 | gate: PASS | feat(storage): Implement HashIndex for O(1) in-memory key indexing |
| da61791 | phase 2 | gate: PASS | feat(storage): Implement DiskSpaceReclaimer for temporary file cleanup |
| 2df9f66 | phase 2 | gate: PASS | feat(queue): Implement DelayQueue with timestamp-ordered execution |
| 58e9537 | phase 2 | gate: PASS | feat(queue): Implement BatchQueueConsumer for high-throughput batch pulling |
