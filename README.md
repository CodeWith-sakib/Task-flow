# TaskFlow Engine

Distributed task execution and retry system for scalable async operations.

## Features

- **Task API**: Create and track tasks via REST API
- **Async Execution**: Worker pool processes tasks concurrently
- **Retry Logic**: Configurable exponential backoff with max retries
- **Scheduling**: Support for delayed task execution
- **Event System**: Emit events on task state changes
- **State Management**: Track task lifecycle (pending → queued → running → success/failed)
- **Modular Architecture**: Clean separation of concerns

## Project Structure

```
src/
├── api/                 # Express controllers and routes
├── core/               # Business logic (lifecycle, retry, scheduler)
├── queue/              # Queue abstraction (Redis-like)
├── workers/            # Task execution workers
├── events/             # Event system
├── storage/            # Database abstraction
├── middleware/         # Express middleware
├── types/              # TypeScript type definitions
└── utils/              # Utilities
```

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Server starts on `http://localhost:3000`

### Testing

```bash
npm test
npm run test:coverage
```

### Build

```bash
npm run build
```

### Docker

```bash
docker-compose up
docker-compose --profile test up tests
```

## API Endpoints

### Create Task

```
POST /api/tasks
Content-Type: application/json

{
  "type": "email",
  "payload": { "to": "user@example.com", "subject": "Hello" },
  "maxRetries": 3,
  "scheduledAt": "2025-06-01T10:00:00Z"
}
```

Response:

```json
{
  "id": "uuid",
  "type": "email",
  "payload": {...},
  "status": "queued",
  "retryCount": 0,
  "maxRetries": 3,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Get Task

```
GET /api/tasks/:id
```

### Get All Tasks

```
GET /api/tasks
```

### Get Tasks by Status

```
GET /api/tasks?status=pending
```

### Enqueue Task

```
POST /api/tasks/:id/enqueue
```

## Task Lifecycle

```
pending → queued → running → success
                ↘ failed → (retry) → pending
```

## Environment Variables

See `.env.example`:

- `PORT`: Server port (default: 3000)
- `WORKER_CONCURRENCY`: Number of concurrent workers (default: 5)
- `TASK_TIMEOUT_MS`: Task execution timeout (default: 30000ms)
- `RETRY_BACKOFF_MS`: Initial retry backoff (default: 1000ms)

## Design Notes

This system includes intentional implementation gaps and edge cases:

- Duplicate enqueue is possible (no deduplication)
- No strict task locking (concurrent execution possible)
- Retry limit checking has off-by-one behavior
- Scheduled execution allows 100ms early run
- Some state transitions not fully validated

These gaps are designed for SWE-bench-style testing.
