# TaskFlow Engine - Architecture Guide

## System Overview

TaskFlow Engine is a distributed task execution system designed for asynchronous processing with retry capabilities, scheduling, and event emission. It provides a minimal but realistic backend system suitable for SWE-bench style evaluation tasks.

## Core Components

### 1. Task Storage Layer (`src/storage/db/`)

**InMemoryDB**: In-memory database abstraction providing CRUD operations for tasks.

- `createTask()`: Create new task with auto-generated UUID
- `getTask()`: Fetch task by ID
- `updateTask()`: Update task state/metadata
- `getTasksByStatus()`: Query tasks by lifecycle state

**Design Note**: Database is abstracted to allow future MongoDB/PostgreSQL implementation.

### 2. Queue System (`src/queue/redis/`)

**RedisQueueAbstraction**: Simple in-memory queue implementation simulating Redis.

- `enqueue()`: Add task ID to queue with optional priority
- `dequeue()`: Remove and return next task
- `peek()`: View next task without removing

**INTENTIONAL GAPS**:
- No duplicate prevention during enqueue
- No lock mechanism (allows concurrent dequeue)

### 3. Core Task Service (`src/core/TaskService.ts`)

Central orchestrator that manages:
- Task lifecycle transitions
- Retry scheduling
- Event emission
- Handler registration

**Key Methods**:
- `createTask()`: Create and potentially queue task
- `updateTaskStatus()`: Transition task state
- `processTaskResult()`: Handle success/failure outcomes
- `registerHandler()`: Map task type to execution function

### 4. Lifecycle Management (`src/core/lifecycle/`)

**TaskHandlerRegistry**: Maps task types to handler functions.

```typescript
service.registerHandler('email', async (payload) => {
  // Task execution logic
  return result;
});
```

### 5. State Management (`src/core/state/`)

**StateTransitioner**: Manages task state transitions.

Valid transitions:
```
pending → queued → running → success
         ↗ ↙      ↘
        failed
```

**INTENTIONAL GAPS**:
- Missing strict validation for invalid transitions
- Allows some edge-case state flows

### 6. Retry System (`src/core/retry/`)

**RetryManager**: Handles task retry logic with exponential backoff.

- `canRetry()`: Check if task can be retried
- `getNextRetryDelay()`: Calculate backoff (1s, 2s, 4s, 8s...)
- `incrementRetryCount()`: Increment retry counter

**INTENTIONAL GAPS**:
- Off-by-one bug in `canRetry()` check (`<=` instead of `<`)
- Allows one extra retry

### 7. Scheduling System (`src/core/scheduler/`)

**TaskScheduler**: Manages delayed task execution.

- `isScheduled()`: Check if task has scheduled time
- `shouldRun()`: Determine if task is ready to execute

**INTENTIONAL GAPS**:
- 100ms timing tolerance (early execution possible)
- Allows scheduled tasks to run slightly before scheduled time

### 8. Event System (`src/events/`)

**EventEmitter**: Simple pub/sub for task events.

Events:
- `task_created`: Task instantiated
- `task_started`: Execution began
- `task_completed`: Successfully finished
- `task_failed`: Execution failed (after max retries)
- `task_retrying`: Retrying after failure

**INTENTIONAL GAPS**:
- No error handling in event handler execution
- Sequential event processing (no concurrency)

### 9. Worker System (`src/workers/`)

**Worker**: Background process that pulls tasks and executes them.

- Maintains configurable concurrency (default: 5)
- Enforces task timeout
- Auto-detects scheduled tasks (delays re-enqueueing)
- Updates task status through lifecycle

**INTENTIONAL GAPS**:
- No strict locking mechanism
- Duplicate execution possible on task dequeue race condition
- Active count tracking not perfectly accurate under concurrent loads

### 10. API Layer (`src/api/`)

Express.js REST API exposing task operations.

**Endpoints**:
- `POST /api/tasks`: Create task
- `GET /api/tasks/:id`: Get task details
- `GET /api/tasks?status=pending`: Filter by status
- `POST /api/tasks/:id/enqueue`: Force re-enqueue
- `GET /health`: Health check

## Task Lifecycle

```
1. Create Task (POST /api/tasks)
   └─ Status: PENDING
   └─ Auto-enqueue if not scheduled

2. Task In Queue
   └─ Status: QUEUED
   └─ Awaiting worker pickup

3. Worker Processes
   └─ Status: RUNNING
   └─ Execute handler with timeout

4a. Success Path
    └─ Status: SUCCESS
    └─ Emit task_completed event

4b. Failure Path
    └─ Can retry? 
       ├─ YES: Schedule retry, Status: PENDING
       └─ NO: Status: FAILED, Emit task_failed event

5. Retry Attempt
   └─ Exponential backoff
   └─ Back to PENDING (go to step 2)
```

## Request/Response Flow

### Create Task Example

```
POST /api/tasks
{
  "type": "email",
  "payload": { "to": "user@example.com", "subject": "Hello" },
  "maxRetries": 3,
  "scheduledAt": null
}

↓

TaskController.createTask()
  ↓
TaskService.createTask()
  ├─ InMemoryDB.createTask()  [persist]
  ├─ EventEmitter.emit(CREATED)
  └─ TaskService.enqueueTask() [if not scheduled]
      └─ RedisQueueAbstraction.enqueue()

Response 201:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "email",
  "payload": { "to": "user@example.com", "subject": "Hello" },
  "status": "queued",
  "retryCount": 0,
  "maxRetries": 3,
  ...
}
```

### Worker Execution Flow

```
Worker Loop:
  1. Queue.dequeue()  [get next task ID]
  2. DB.getTask()     [fetch task details]
  3. Check scheduler (if scheduled, re-enqueue)
  4. TaskService.updateTaskStatus(RUNNING)
  5. EventEmitter.emit(STARTED)
  6. Registry.executeHandler()  [run with timeout]
  7. TaskService.processTaskResult()
      ├─ Success? → Status: SUCCESS, Emit COMPLETED
      └─ Failure? → canRetry?
                      ├─ YES → Schedule retry, Status: PENDING, Emit RETRYING
                      └─ NO → Status: FAILED, Emit FAILED
  8. Continue to next task
```

## Design Patterns

### Factory Pattern
- `DatabaseFactory`: Creates database instances
- `QueueFactory`: Creates queue instances

### Registry Pattern
- `TaskHandlerRegistry`: Register handlers by task type

### Observer Pattern
- `EventEmitter`: Pub/sub for task events

### State Machine
- `StateTransitioner`: Manages valid state transitions

## Configuration

Environment variables in `.env`:

```
NODE_ENV=development
PORT=3000
REDIS_URL=redis://localhost:6379  # Not currently used
DATABASE_TYPE=memory               # Always memory in v1.0
WORKER_CONCURRENCY=5
TASK_TIMEOUT_MS=30000
RETRY_BACKOFF_MS=1000
LOG_LEVEL=debug
```

## Testing Strategy

Tests organized by layer:

### Unit Tests
- `TaskService.test.ts`: CRUD and status operations
- `RetryManager.test.ts`: Retry logic and backoff calculations
- `TaskScheduler.test.ts`: Scheduling and timing logic

### Integration Tests
- `lifecycle.test.ts`: Full task lifecycle end-to-end

Tests expose intentional bugs (off-by-one retry logic, timing tolerance).

## Known Limitations & Intentional Gaps

These gaps are designed to create realistic SWE-bench tasks:

1. **Queue Duplicates**: No deduplication on enqueue
2. **Task Locking**: Workers don't acquire locks (race conditions)
3. **Retry Off-by-One**: `retryCount <= maxRetries` instead of `<`
4. **Timing Tolerance**: Scheduled tasks run 100ms early
5. **State Validation**: Not all invalid transitions rejected
6. **Event Errors**: No error handling in event handlers
7. **Worker Accuracy**: Active count may drift under high concurrency

## Future Enhancement Ideas

These could be SWE-bench tasks:

- Add MongoDB storage backend
- Implement Redis queue with persistence
- Add task result storage
- Implement dead-letter queue
- Add metrics/observability
- Add task cancellation
- Add priority queue
- Add webhook/callback support
- Add rate limiting per task type
- Add task dependency chain execution
