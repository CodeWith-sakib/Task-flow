# TaskFlow Engine - API Usage Guide

## Overview

TaskFlow Engine exposes a REST API for creating, monitoring, and managing asynchronous tasks.

## Base URL

```
http://localhost:3000/api
```

## Health Check

```bash
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-06-01T10:30:00Z"
}
```

---

## Endpoints

### 1. Create Task

**Endpoint**: `POST /api/tasks`

**Description**: Create a new task for async execution.

**Request Body**:
```json
{
  "type": "string (required)",
  "payload": "object (required)",
  "maxRetries": "number (optional, default: 3)",
  "scheduledAt": "ISO8601 timestamp (optional)"
}
```

**Example - Immediate Execution**:
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "send_email",
    "payload": {
      "to": "user@example.com",
      "subject": "Hello",
      "body": "Welcome to TaskFlow"
    },
    "maxRetries": 3
  }'
```

**Response (201 Created)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "send_email",
  "payload": {
    "to": "user@example.com",
    "subject": "Hello",
    "body": "Welcome to TaskFlow"
  },
  "status": "queued",
  "retryCount": 0,
  "maxRetries": 3,
  "scheduledAt": null,
  "createdAt": "2025-06-01T10:00:00Z",
  "updatedAt": "2025-06-01T10:00:00Z"
}
```

**Example - Scheduled Execution**:
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generate_report",
    "payload": {
      "reportType": "daily",
      "date": "2025-06-01"
    },
    "maxRetries": 2,
    "scheduledAt": "2025-06-01T15:00:00Z"
  }'
```

**Response (201 Created)**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "type": "generate_report",
  "payload": {
    "reportType": "daily",
    "date": "2025-06-01"
  },
  "status": "pending",
  "retryCount": 0,
  "maxRetries": 2,
  "scheduledAt": "2025-06-01T15:00:00Z",
  "createdAt": "2025-06-01T10:00:00Z",
  "updatedAt": "2025-06-01T10:00:00Z"
}
```

**Error Response (400 Bad Request)**:
```json
{
  "error": "type and payload are required"
}
```

---

### 2. Get Task by ID

**Endpoint**: `GET /api/tasks/:id`

**Description**: Retrieve task details and current status.

**Parameters**:
- `id` (path): Task UUID

**Example**:
```bash
curl http://localhost:3000/api/tasks/550e8400-e29b-41d4-a716-446655440000
```

**Response (200 OK)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "send_email",
  "payload": {
    "to": "user@example.com",
    "subject": "Hello",
    "body": "Welcome to TaskFlow"
  },
  "status": "running",
  "retryCount": 0,
  "maxRetries": 3,
  "scheduledAt": null,
  "createdAt": "2025-06-01T10:00:00Z",
  "updatedAt": "2025-06-01T10:00:01Z"
}
```

**Response (404 Not Found)**:
```json
{
  "error": "Task not found"
}
```

---

### 3. Get All Tasks

**Endpoint**: `GET /api/tasks`

**Description**: Retrieve all tasks in the system.

**Example**:
```bash
curl http://localhost:3000/api/tasks
```

**Response (200 OK)**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "send_email",
    "status": "success",
    "retryCount": 0,
    "maxRetries": 3,
    "createdAt": "2025-06-01T10:00:00Z",
    "updatedAt": "2025-06-01T10:00:02Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "type": "generate_report",
    "status": "failed",
    "retryCount": 3,
    "maxRetries": 3,
    "error": "Timeout after 30000ms",
    "createdAt": "2025-06-01T10:00:01Z",
    "updatedAt": "2025-06-01T10:01:05Z"
  }
]
```

---

### 4. Filter Tasks by Status

**Endpoint**: `GET /api/tasks?status=STATUS`

**Description**: Filter tasks by their current status.

**Query Parameters**:
- `status` (required): One of `pending`, `queued`, `running`, `success`, `failed`

**Example - Get all pending tasks**:
```bash
curl "http://localhost:3000/api/tasks?status=pending"
```

**Example - Get all failed tasks**:
```bash
curl "http://localhost:3000/api/tasks?status=failed"
```

**Response (200 OK)**:
```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "type": "process_data",
    "status": "failed",
    "error": "Database connection failed",
    "retryCount": 3,
    "maxRetries": 3,
    "scheduledAt": null,
    "createdAt": "2025-06-01T10:05:00Z",
    "updatedAt": "2025-06-01T10:06:30Z"
  }
]
```

---

### 5. Re-enqueue Task

**Endpoint**: `POST /api/tasks/:id/enqueue`

**Description**: Manually re-enqueue a task for processing.

**Parameters**:
- `id` (path): Task UUID

**Request Body**:
```json
{
  "priority": "number (optional, default: 0)"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/tasks/550e8400-e29b-41d4-a716-446655440000/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "priority": 1
  }'
```

**Response (200 OK)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "send_email",
  "status": "queued",
  "retryCount": 0,
  "maxRetries": 3,
  "updatedAt": "2025-06-01T10:30:00Z"
}
```

---

## Task Status Values

| Status | Description |
|--------|-------------|
| `pending` | Waiting to be queued (may be scheduled) |
| `queued` | In queue, waiting for worker pickup |
| `running` | Currently being processed by worker |
| `success` | Completed successfully |
| `failed` | Failed after max retries exceeded |

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "type and payload are required"
}
```

### 404 Not Found
```json
{
  "error": "Task not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

---

## Task Lifecycle Diagrams

### Successful Task
```
POST /tasks
   ↓
status: queued
   ↓
Worker picks up task
   ↓
status: running
   ↓
Handler execution succeeds
   ↓
status: success
   ↓
GET /tasks/:id → success
```

### Failed Task with Retries
```
POST /tasks (maxRetries: 2)
   ↓
status: queued
   ↓
Worker processes → Handler fails
   ↓
status: pending (retry_count: 1)
scheduledAt: now + 1000ms
   ↓
Wait for scheduled time
   ↓
Worker picks up again
   ↓
Handler fails again
   ↓
status: pending (retry_count: 2)
scheduledAt: now + 2000ms
   ↓
Worker picks up final time
   ↓
Handler fails again
   ↓
Max retries exceeded
   ↓
status: failed (retry_count: 2)
error: "Error message"
```

### Scheduled Task
```
POST /tasks
  scheduledAt: "2025-06-01T15:00:00Z"
   ↓
status: pending
   ↓
Worker checks timing
   ↓
If not ready: re-enqueue for later check
   ↓
When scheduledAt time reached:
   ↓
status: queued
   ↓
[Normal processing flow]
```

---

## Example Workflows

### Workflow 1: Simple Email Send

```bash
# Create task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "send_email",
    "payload": {"to": "user@example.com", "subject": "Hello"},
    "maxRetries": 3
  }'

# Check status
curl http://localhost:3000/api/tasks/TASK_ID

# Wait a few seconds...

# Check again (should be success or failed)
curl http://localhost:3000/api/tasks/TASK_ID
```

### Workflow 2: Batch Processing with Retry

```bash
# Create multiple tasks
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/tasks \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"process_batch_item\",
      \"payload\": {\"itemId\": $i},
      \"maxRetries\": 5
    }"
done

# Monitor progress
curl "http://localhost:3000/api/tasks?status=running"
curl "http://localhost:3000/api/tasks?status=pending"
curl "http://localhost:3000/api/tasks?status=failed"

# Get final results
curl "http://localhost:3000/api/tasks?status=success"
```

### Workflow 3: Scheduled Report Generation

```bash
# Schedule report for tomorrow 2 PM
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generate_daily_report",
    "payload": {"reportDate": "2025-06-02"},
    "maxRetries": 2,
    "scheduledAt": "2025-06-02T14:00:00Z"
  }'

# Task status will remain pending until scheduled time
curl http://localhost:3000/api/tasks/TASK_ID

# Worker will process at scheduled time automatically
```

---

## Response Time Expectations

- Task creation: <50ms
- Task retrieval: <10ms
- Task filtering: <100ms depending on task count
- Task execution: Depends on handler logic (typical 100-5000ms)
- Retry delay: Exponential backoff (1s, 2s, 4s, 8s...)

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding for production use.

---

## Pagination

Not yet implemented. For large task counts, use status filtering:

```bash
curl "http://localhost:3000/api/tasks?status=pending"
```

---

## WebSocket Support

Not currently supported. Use polling with `GET /api/tasks/:id` to monitor task status.

---

## Authentication

Not currently implemented. Add before production deployment.
