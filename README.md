# TaskFlow Engine

Industrial-grade distributed task execution, workflow DAG orchestration, and benchmark engine.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-115%20passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)]()
[![Benchmark](https://img.shields.io/badge/defects-28%20packaged-orange.svg)]()

---

## Key Subsystems & Architecture

TaskFlow Engine is engineered for fault-tolerant async execution, distributed coordination, and reproducible evaluation:

1. **Storage Subsystem**:
   - Write-Ahead Logging (`WALStorageEngine`) with binary CRC32 checksums, fsync persistence, and automatic snapshot compaction.
   - Multi-dimensional `SecondaryIndex` indexing by status, type, and priority range.
   - Uniform `IDatabase` abstraction supporting both `InMemoryDB` and `WALDatabaseAdapter`.

2. **Queuing Subsystem**:
   - `VisibilityQueue`: Two-phase ACK/NACK visibility leases modeled after AWS SQS.
   - Dead-Letter Queue (`DeadLetterQueue`) with configurable retention and replay capabilities.
   - Delayed task scheduling with sub-second precision.

3. **Workflows & DAG Engine**:
   - `DAGValidator`: Cyclic dependency detection and topological sorting via Kahn's algorithm.
   - `WorkflowEngine`: Multi-step orchestration with parallel tier execution, context propagation across steps, and Saga rollback compensations.

4. **Scheduling Subsystem**:
   - Standard 5-field `CronParser` with wildcard, range, step, and list support.
   - Deterministic UTC time arithmetic preventing Daylight Saving / timezone drift.
   - `CronScheduler`: Misfire handling policies (`skip` vs `fire_once`).

5. **Concurrency & Rate Limiting**:
   - `LeaseManager`: Distributed mutual exclusion with monotonically increasing fencing tokens.
   - `TokenBucketRateLimiter`: Configurable token replenishment for tenant traffic shaping.
   - `WorkerPoolAutoscaler`: Dynamic concurrency adjustment driven by queue depth.

6. **Webhooks & Resilience**:
   - `WebhookDispatcher`: Asynchronous event delivery with HMAC-SHA256 signature headers (`X-TaskFlow-Signature`).
   - `CircuitBreaker`: Cooldown and half-open state transitions protecting external endpoints.

7. **Observability & Diagnostics**:
   - Native Prometheus endpoint (`GET /metrics`) exporting counters, gauges, and histograms.
   - W3C Distributed Tracing (`traceparent`) context propagation.
   - Structured JSON logging with request correlation IDs.
   - Embedded HTML status dashboard (`GET /status`).
   - CLI diagnostic tool (`taskflow`).

8. **Security & Multi-Tenancy**:
   - Role-based API Key management (`admin`, `operator`, `readonly`).
   - Tenant quota enforcement for concurrency and rate limits.

---

## Quick Start

### Installation

```bash
npm install
```

### Verification & Testing

```bash
# Typecheck
npm run lint

# Build
npm run build

# Run comprehensive test suite (Unit, Integration, E2E, Boundary, Fuzz, Persistence)
npm test

# Generate coverage report
npm test -- --coverage
```

### Starting the Server

```bash
npm start
```

Default HTTP endpoints:
- `POST /api/tasks` — Submit task
- `GET /api/tasks/:id` — Query task status
- `GET /health` — Service healthcheck
- `GET /metrics` — Prometheus metrics
- `GET /status` — HTML operational dashboard

---

## Benchmark & Defect Catalog

TaskFlow Engine includes an industrial defect benchmark located in `internal-bench/`:
- **Defects Catalog**: [`internal-bench/defects.yaml`](file:///Users/mohammadsakib/Desktop/Personal/AfterQuery/TaskFlow-Engine/internal-bench/defects.yaml) contains 28 cataloged defects across 12 distinct engineering categories.
- **Sand-Style Tasks**: Packaged inside `internal-bench/tasks/<TASKFLOW-DEF-XXX>/` with individual `instructions.md` and `task.json` verification specs.
- **Benchmark Notes**: See [`BENCHMARK_NOTES.md`](file:///Users/mohammadsakib/Desktop/Personal/AfterQuery/TaskFlow-Engine/BENCHMARK_NOTES.md) for full benchmark methodology.

---

## License

MIT
