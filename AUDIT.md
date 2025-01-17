# Phase 0 — Repository Audit: TaskFlow-Engine

## 1. Executive Summary

- **Repository Name**: TaskFlow-Engine
- **Domain**: Distributed task execution, asynchronous worker queue, scheduling, and retry management system.
- **Language / Runtime**: TypeScript 5.0.2 on Node.js (v20.19.6 runtime, targeting Node 18+).
- **Current Status**: Early working prototype with 7 synthetic commits and 17 first-party source files (~741 pure code LOC). Untracked files and uncommitted changes currently cause typecheck (`npm run lint`) and test (`npm test`) failures.
- **Target Profile**: 32,000–40,000 first-party production LOC, 150+ meaningful incremental commits, 8-category test suite, clean deterministic baseline, and 25–30 verified independent defect injections.

---

## 2. First-Party Code & Lines of Code (LOC)

### Source Breakdown (TypeScript)

| Component | Files | Total Lines | Code LOC | Blank | Comments |
|---|---|---|---|---|---|
| **Production Source (`src/`)** | 17 | 930 | 741 | 172 | 17 |
| **Test Suite (`tests/`)** | 6 | 445 | 326 | 94 | 25 |
| **Root Scripts (`example.ts`)** | 1 | 36 | 28 | 6 | 2 |
| **Total First-Party TypeScript** | **24** | **1,411** | **1,095** | **272** | **44** |

### Per-File Production Source Inventory (`src/`)

| File | Subsystem | Lines | Code LOC | Description |
|---|---|---|---|---|
| `src/types/index.ts` | Core Types | 56 | 47 | Enums, interfaces for Tasks, Payloads, Handlers, Workers, Queues, Events |
| `src/core/TaskService.ts` | Orchestration | 147 | 114 | Main domain service coordinating DB, Queue, Events, Workers, Schedulers |
| `src/core/lifecycle/TaskHandlerRegistry.ts` | Core Lifecycle | 30 | 25 | In-memory registry for task execution handlers |
| `src/core/retry/RetryManager.ts` | Core Retry | 32 | 26 | Retry calculation, backoff math, retry threshold checks |
| `src/core/scheduler/TaskScheduler.ts` | Core Scheduler | 32 | 26 | Scheduled task eligibility evaluation and time calculations |
| `src/core/state/StateTransitioner.ts` | Core State | 23 | 20 | State machine rules for task statuses |
| `src/events/EventEmitter.ts` | Event Subsystem | 60 | 48 | Pub/Sub event bus with listener error isolation |
| `src/queue/redis/RedisQueueAbstraction.ts` | Queue | 54 | 44 | In-memory priority queue emulating Redis-like semantics |
| `src/queue/redis/index.ts` | Queue Factory | 9 | 7 | Factory function `createQueue()` |
| `src/storage/db/InMemoryDB.ts` | Storage | 57 | 45 | Map-based in-memory task database implementation |
| `src/storage/db/index.ts` | Storage Factory | 15 | 12 | Factory function `createDB()` |
| `src/workers/Worker.ts` | Worker Engine | 136 | 111 | Background task processor, execution lock, retry orchestration |
| `src/api/controllers/TaskController.ts` | REST API | 85 | 68 | Express controller endpoints for Task CRUD and re-enqueue |
| `src/api/routes/taskRoutes.ts` | REST API | 19 | 15 | Express router mapping endpoints to controller |
| `src/middleware/index.ts` | Middleware | 19 | 16 | Express error handler and request logger |
| `src/utils/logger.ts` | Utilities | 19 | 16 | Console logger with leveled logging |
| `src/index.ts` | Application Entry | 120 | 81 | Server bootstrapping, health check, graceful shutdown |

### Non-Code Assets & Documentation
- **Configuration**: `package.json` (39 lines), `package-lock.json` (4,064 lines), `tsconfig.json` (25 lines), `jest.config.js` (15 lines), `Dockerfile` (12 lines), `docker-compose.yml` (23 lines), `.env.example` (7 lines), `.gitignore` (6 lines).
- **Documentation**: 9 Markdown/Text files (`00-START-HERE.md`, `API_GUIDE.md`, `ARCHITECTURE.md`, `COMPLETION_CHECKLIST.md`, `FILE_MANIFEST.md`, `INDEX.md`, `PROJECT_SUMMARY.md`, `README.md`, `VERIFICATION_REPORT.txt`) totaling ~2,500 lines.
- **Vendor / Generated**: `node_modules/` (excluded), `dist/` (excluded).

---

## 3. Commit Count & Git History Quality

- **Current Commit Count**: `git log --oneline | wc -l` = **7**
- **Time Span**: All 7 commits were authored between `2026-09-06 17:18:20 +0530` and `2026-09-06 17:25:11 +0530` (span: **6 minutes 51 seconds**).
- **Commit Log**:
  1. `ec12e04` - *fix: Retry off-by-one bug in RetryManager.canRetry()*
  2. `240e87a` - *fix: Remove timing tolerance in TaskScheduler.shouldRun()*
  3. `c08dfdd` - *fix: Add error handling in EventEmitter.emit()*
  4. `f190d01` - *fix: Strict state transition validation in StateTransitioner and TaskService*
  5. `5d803c7` - *fix: Add duplicate prevention in RedisQueueAbstraction.enqueue()*
  6. `f05f461` - *fix: Add strict locking and fix active count drift in Worker*
  7. `dc5c489` - *feat: Add task priority support*
- **History Quality Assessment**:
  - **Synthetic & Incomplete**: Only 8 source files are currently tracked in git. The initial commit was not an initial commit of the repository codebase, but a one-file bug fix. Crucial foundational files (`package.json`, `tsconfig.json`, `src/index.ts`, `src/api/`, all `tests/`, and documentation) remain untracked.
  - **Zero Organic Spread**: 7 commits in 7 minutes indicates rapid scripted commits rather than realistic incremental engineering.
  - **Uncommitted Modifications**: `src/types/index.ts` has uncommitted modifications (`deadline` field added), which breaks existing code referencing `Task`.

---

## 4. Subsystem Inventory & Architecture

```
                               ┌────────────────────────────────┐
                               │       HTTP Clients / CLI       │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
                              ┌──────────────────────────────────┐
                              │     Express API / Middleware     │
                              │ (TaskController, Routes, Loggers)│
                              └────────────────┬─────────────────┘
                                               │
                                               ▼
                              ┌──────────────────────────────────┐
                              │           TaskService            │
                              │      (Central Orchestrator)      │
                              └─┬──────────────┬───────────────┬─┘
                                │              │               │
       ┌────────────────────────┘              │               └────────────────────────┐
       ▼                                       ▼                                        ▼
┌──────────────┐                     ┌──────────────────┐                     ┌──────────────────┐
│  InMemoryDB  │                     │   EventEmitter   │                     │    RedisQueue    │
│  (Storage)   │                     │  (Pub/Sub Bus)   │                     │   (Priority Q)   │
└──────────────┘                     └──────────────────┘                     └────────┬─────────┘
                                                                                       │
                                                                                       ▼
                                                                              ┌──────────────────┐
                                                                              │      Worker      │
                                                                              │ (Execution Engine│
                                                                              └────────┬─────────┘
                                                                                       │
                                          ┌─────────────────────┬──────────────────────┴────────────────────┐
                                          ▼                     ▼                                           ▼
                               ┌─────────────────────┐┌──────────────────┐                       ┌─────────────────────┐
                               │ TaskHandlerRegistry ││   RetryManager   │                       │    TaskScheduler    │
                               │  (Handler Mappings) ││ (Backoff Math)   │                       │ (Timing Validation) │
                               └─────────────────────┘└──────────────────┘                       └─────────────────────┘
```

### Subsystems and Boundaries
1. **API Layer (`src/api/`, `src/middleware/`)**:
   - Manages HTTP REST interface (`POST /api/tasks`, `GET /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks/:id/enqueue`, `GET /health`).
   - Translates HTTP requests to `TaskService` calls and handles status code mappings.
2. **Core Domain Orchestrator (`src/core/TaskService.ts`)**:
   - Coordinates storage persistence, queue placement, event publishing, and worker registration.
   - Enforces business rules and state updates.
3. **Lifecycle & State Machine (`src/core/state/`, `src/core/lifecycle/`)**:
   - `StateTransitioner`: Governs allowed transitions (`PENDING -> QUEUED -> RUNNING -> SUCCESS | FAILED`).
   - `TaskHandlerRegistry`: Type-to-execution mapping for asynchronous handlers.
4. **Retry & Scheduling Subsystem (`src/core/retry/`, `src/core/scheduler/`)**:
   - `RetryManager`: Evaluates `canRetry(task)` and computes exponential backoff delay (`baseDelay * 2^retryCount`).
   - `TaskScheduler`: Verifies wall-clock triggers against `task.scheduledAt`.
5. **Execution Worker Subsystem (`src/workers/`)**:
   - `Worker`: Worker loop fetching tasks from the queue, acquiring mutex lock (`WorkerLock`), invoking handlers, handling timeouts, managing active execution counts, and re-enqueueing for retries.
6. **Queue Subsystem (`src/queue/`)**:
   - `RedisQueueAbstraction`: Simulates a Redis-backed priority queue in memory with duplicate taskId rejection and priority sorting.
7. **Persistence Subsystem (`src/storage/`)**:
   - `InMemoryDB`: Basic in-memory key-value/map store for `Task` entities.
8. **Event Notification Subsystem (`src/events/`)**:
   - `EventEmitter`: Internal decoupled observer mechanism emitting `task_created`, `task_started`, `task_completed`, `task_failed`, `task_retrying`.

---

## 5. Test-Suite Inventory Across 8 Target Categories

The existing test suite comprises **5 test files** (plus 1 test setup file), with a total of **23 test cases**:

| Test Category | Target Status | Current Test Files / Locations | Count | Current Coverage Assessment |
|---|---|---|---|---|
| **1. Unit** | Partially Covered | `tests/unit/TaskService.test.ts`<br>`tests/unit/RetryManager.test.ts`<br>`tests/unit/TaskScheduler.test.ts` | 18 | Tests TaskService methods, retry backoff calculation, and schedule time logic. **Missing**: dedicated unit tests for `Worker`, `WorkerLock`, `RedisQueueAbstraction`, `InMemoryDB`, `EventEmitter`, `TaskHandlerRegistry`. |
| **2. Integration** | Partially Covered | `tests/integration/worker.test.ts`<br>`tests/integration/lifecycle.test.ts` | 5 | Tests worker execution and task lifecycle end-to-end through service and worker in-memory. |
| **3. API** | **Missing (0%)** | None | 0 | Zero tests for Express endpoints (`POST /api/tasks`, `GET /api/tasks/:id`, filtering, error middleware). `supertest` is not installed. |
| **4. Persistence** | **Missing (0%)** | None (only implicit via TaskService) | 0 | No tests validating database durability, isolation, secondary query indexing, sorting, pagination, or storage failure handling. |
| **5. Concurrency** | **Missing (0%)** | None | 0 | No tests validating concurrent worker execution, queue contention, lock collisions, or race condition prevention under heavy load. |
| **6. Error-Handling**| **Thin (<15%)** | `tests/integration/worker.test.ts` (1 test) | 1 | Only tests retry exhaustion leading to `FAILED`. Missing crash recovery, worker timeout ejection, handler exceptions, queue failures. |
| **7. Boundary** | **Thin (<15%)** | `tests/unit/TaskScheduler.test.ts` (1 test) | 1 | Only tests boundary around scheduled time. Missing zero retries, empty queue dequeue, extreme payload sizes, timestamp limits. |
| **8. End-to-End** | **Missing (0%)** | None | 0 | Existing integration tests bypass HTTP API, middlewares, network serialization, and full application bootstrap. |

**Total Existing Tests**: 23 test cases (currently failing compilation/execution due to uncommitted type drift).

---

## 6. Detected Stack, Pinned Versions & Tooling

- **Language**: TypeScript 5.0.2
- **Runtime**: Node.js v20.19.6 (host), `@types/node` ^18.15.11
- **Framework**: Express.js ^4.18.2
- **Build Tool**: `tsc` (TypeScript Compiler)
- **Test Runner**: Jest ^29.5.0 with `ts-jest` ^29.1.0
- **Package Manager**: npm 10.8.2
- **Current `package.json` Dependencies**:
  - `dotenv`: `^16.0.3`
  - `express`: `^4.18.2`
  - `uuid`: `^9.0.0`
- **Current `package.json` DevDependencies**:
  - `@types/express`: `^4.17.17`
  - `@types/jest`: `^29.5.0`
  - `@types/node`: `^18.15.11`
  - `@types/uuid`: `^9.0.2`
  - `jest`: `^29.5.0`
  - `ts-jest`: `^29.1.0`
  - `ts-node`: `^10.9.1`
  - `typescript`: `^5.0.2`

---

## 7. Verbatim Repo Commands (Tooling Reference)

These are the exact commands configured in the repository's `package.json` and toolchain:

| Operation | Exact Command | Execution Details |
|---|---|---|
| **Build** | `npm run build` | Runs `tsc` (outputs compiled JavaScript to `dist/`) |
| **Lint / Typecheck** | `npm run lint` | Runs `tsc --noEmit` |
| **Test** | `npm test` | Runs `jest` via `ts-jest` |
| **Test Watch** | `npm run test:watch` | Runs `jest --watch` |
| **Test Coverage** | `npm run test:coverage` | Runs `jest --coverage` |
| **Development** | `npm run dev` | Runs `ts-node src/index.ts` |
| **Production Start** | `npm start` | Runs `node dist/index.js` |
| **Git Operations** | `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null git <args>` | Required for clean execution in sandboxed terminal environments |

---

## 8. Computed Gap Against Target Profile

### 1. LOC Gap
- **Target**: 32,000–40,000 first-party production source lines (excluding tests, vendor, generated code).
- **Current**: 741 code LOC (930 total lines) across 17 files in `src/`.
- **Gap**: ~31,000–39,000 LOC.
- **Strategy**: As instructed in Phase 1, we must determine domain-appropriate architectural extensions (e.g., persistent storage backends, distributed consensus/leader election, dead-letter queues, advanced cron/DAG scheduling, metrics/OpenTelemetry instrumentation, webhook dispatchers, rate-limiters, CLI tooling, status dashboard) or document intentional scope constraints in `ENHANCEMENT_PLAN.md`.

### 2. Commit Count Gap
- **Target**: 150+ meaningful incremental commits across git history.
- **Current**: 7 commits.
- **Gap**: **143+ commits**.
- **Strategy**: Incremental progression through Phase 2 to Phase 8 with strictly enforced per-commit gates, structured commit logs, and realistic timestamp dispersion.

### 3. Test Categories Gap
- 5 of 8 categories (API, Persistence, Concurrency, Boundary, End-to-End) are either completely missing or severely deficient.
- All subsystems need multi-category test coverage (minimum 5 of 8 categories per subsystem).

### 4. Feasibility Analysis of the 12 Defect Categories (TypeScript / Node.js Stack)

| Category | Feasibility | Technical Detection Mechanism in this Stack |
|---|---|---|
| **1. Type-safety mistakes** | **High** | TypeScript compiler (`tsc --noEmit`) with strict flags, targeted unit tests catching `undefined` dereferences and bad type casts (`as any`). |
| **2. Incorrect state transitions** | **High** | State machine validation tests, invalid transition matrix assertions (`StateTransitioner.canTransition`). |
| **3. Resource-management problems** | **High** | Unclosed timers (`setInterval`/`setTimeout`), unhandled stream handles, mutex lock release omission in error branches. |
| **4. Concurrency/race conditions** | **High** | Async interleaving, event loop tick reentrancy, TOCTOU in worker task dequeue, concurrent execution without distributed lock. |
| **5. Stale-cache behavior** | **High** | Task metadata cache, priority queue cache invalidation, expired scheduled task TTL checks. |
| **6. Boundary-condition errors** | **High** | Off-by-one errors in `maxRetries`, schedule timestamp microsecond boundary drift, zero/negative intervals, empty queue dequeue. |
| **7. Incorrect error propagation** | **High** | Unhandled promise rejections, swallowed handler errors, missing HTTP error status code translation. |
| **8. Serialization/deserialization inconsistencies** | **High** | `Date` vs ISO string serialization in JSON/storage/queue, bigint/undefined loss in task payload transfers. |
| **9. Lifecycle bugs** | **High** | Server shutdown hanging on active workers, worker loop starting before DB/Queue ready, unhandled signal traps. |
| **10. Configuration mistakes** | **High** | Environment variable parsing, type coercion (e.g. `PORT="3000"` vs `3000`, `MAX_RETRIES="0"` treated as falsy), config precedence. |
| **11. Validation gaps** | **High** | Missing schema validation on task payload, missing UUID format validation, unvalidated cron expressions. |
| **12. Memory/resource leaks** | **High** | Event listener leaks (`MaxListenersExceededWarning` in `EventEmitter`), unbounded Map growth in `InMemoryDB`, uncollected timeout handles. |

*(Note: While Node.js is a garbage-collected single-threaded event loop environment without C-style raw memory safety defects or multi-threaded memory-data races, all 12 categories—including memory retention leaks and async concurrency races—are fully viable and realistic).*

---

## 9. Next Steps

Phase 0 audit is complete. The next action is formulating **`ENHANCEMENT_PLAN.md`** (Phase 1), laying out the detailed subsystem roadmap, commit allocation, commit log schema, and defect distribution before any code modifications begin.
