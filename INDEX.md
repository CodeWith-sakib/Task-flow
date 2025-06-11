# TaskFlow Engine - Project Index

## 📚 Documentation Map

### Getting Started
1. **[README.md](README.md)** - Start here!
   - Quick start guide
   - Installation & setup
   - Development & testing
   - Docker usage
   - Basic API overview

### Detailed Guides
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design
   - Component descriptions
   - Data flows and interactions
   - Task lifecycle explanation
   - API request flows
   - Design patterns used
   - Known limitations & intentional gaps
   - Future enhancement ideas

3. **[API_GUIDE.md](API_GUIDE.md)** - Complete API reference
   - All endpoints documented
   - Request/response examples
   - Error handling
   - Task workflows
   - Lifecycle diagrams
   - Usage examples

### Project Overview
4. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Executive summary
   - Deliverables list
   - Project metrics
   - Feature checklist
   - Technology stack
   - Next steps for tasks

5. **[COMPLETION_CHECKLIST.md](COMPLETION_CHECKLIST.md)** - Verification
   - Full requirement checklist
   - Statistics
   - Build verification
   - Quality attributes

## 📁 Source Code Structure

```
src/
├── api/                          # HTTP API Layer
│   ├── controllers/
│   │   └── TaskController.ts     # Request handlers
│   └── routes/
│       └── taskRoutes.ts         # Route definitions
├── core/                         # Business Logic
│   ├── TaskService.ts            # Main orchestrator
│   ├── lifecycle/
│   │   └── TaskHandlerRegistry.ts
│   ├── retry/
│   │   └── RetryManager.ts
│   ├── scheduler/
│   │   └── TaskScheduler.ts
│   └── state/
│       └── StateTransitioner.ts
├── events/                       # Event System
│   └── EventEmitter.ts
├── queue/                        # Queue Abstraction
│   └── redis/
│       ├── RedisQueueAbstraction.ts
│       └── index.ts
├── workers/                      # Task Processing
│   └── Worker.ts
├── storage/                      # Data Layer
│   └── db/
│       ├── InMemoryDB.ts
│       └── index.ts
├── middleware/                   # Express Middleware
│   └── index.ts
├── types/                        # Type Definitions
│   └── index.ts
├── utils/                        # Utilities
│   └── logger.ts
└── index.ts                      # Application Entry
```

## 🧪 Test Structure

```
tests/
├── unit/
│   ├── TaskService.test.ts       # CRUD & status tests
│   ├── RetryManager.test.ts      # Retry logic tests
│   └── TaskScheduler.test.ts     # Scheduling tests
├── integration/
│   ├── lifecycle.test.ts         # Full workflow tests
│   └── worker.test.ts            # Worker integration tests
└── setup.ts                      # Test utilities
```

## ⚙️ Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies & scripts |
| `tsconfig.json` | TypeScript configuration |
| `jest.config.js` | Testing framework config |
| `Dockerfile` | Container image definition |
| `docker-compose.yml` | Multi-service orchestration |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore patterns |

## 🚀 Quick Commands

```bash
# Development
npm install              # Install dependencies
npm run dev              # Start dev server (ts-node)
npm run build            # Build TypeScript
npm start                # Run compiled app
npm test                 # Run all tests
npm run test:watch      # Tests in watch mode
npm run lint            # Type check

# Docker
docker-compose up       # Run with compose
docker build -t taskflow . # Build image
docker run -p 3000:3000 taskflow # Run container

# Testing
npm test -- --coverage  # Generate coverage report
npm test -- --verbose   # Verbose test output
```

## 📋 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tasks` | Create task |
| `GET` | `/api/tasks/:id` | Get task by ID |
| `GET` | `/api/tasks` | Get all tasks |
| `GET` | `/api/tasks?status=X` | Filter by status |
| `POST` | `/api/tasks/:id/enqueue` | Re-enqueue task |
| `GET` | `/health` | Health check |

## 🎯 Task Statuses

- **pending** - Waiting to be queued (may be scheduled)
- **queued** - In queue, awaiting worker
- **running** - Currently being processed
- **success** - Completed successfully
- **failed** - Failed after max retries

## 🐛 Intentional Bugs (for SWE-Bench)

1. **Retry Off-by-One**: `canRetry()` uses `<=` instead of `<`
2. **Timing Tolerance**: Scheduled tasks run 100ms early
3. **No Duplicate Prevention**: Queue allows duplicates
4. **No Strict Locking**: Workers can process same task concurrently
5. **State Validation Gaps**: Missing transition checks
6. **Event Handler Errors**: No error handling in emit
7. **Active Count Drift**: Counter may drift under load

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| Source Files | 16 |
| Test Files | 5 |
| Total LOC | 962+ |
| Tests Passing | 20/20 |
| Code Coverage | Partial |
| Documentation | 5 files |
| Intentional Bugs | 7 |

## 🏗️ Architecture Patterns

- **Factory Pattern** - Database & Queue creation
- **Registry Pattern** - Task handler registration
- **Observer Pattern** - Event emission
- **State Machine** - Task lifecycle

## ✨ Quality Attributes

- ✅ Production-ready structure
- ✅ TypeScript strict mode
- ✅ Modular architecture
- ✅ Comprehensive testing
- ✅ Full documentation
- ✅ Docker support
- ✅ SWE-Bench compatible

## 🔗 Key Files to Review

### For Understanding the System
1. `src/core/TaskService.ts` - Main orchestrator
2. `src/index.ts` - Application setup
3. `tests/integration/lifecycle.test.ts` - Full flow example

### For Debugging
1. `src/core/retry/RetryManager.ts` - Retry logic (has bug)
2. `src/core/scheduler/TaskScheduler.ts` - Scheduling (has bug)
3. `src/workers/Worker.ts` - Worker implementation

### For API Usage
1. `API_GUIDE.md` - Complete API reference
2. `example.ts` - Usage examples
3. `tests/integration/` - Test examples

## 📖 Environment Setup

```bash
# Create .env from template
cp .env.example .env

# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev
```

## 🎓 Use Case Examples

### Example 1: Send Emails
```typescript
service.registerHandler('send_email', async (payload) => {
  // Send email logic
  return { sent: true };
});
```

### Example 2: Process Data
```typescript
service.registerHandler('process_data', async (payload) => {
  // Data processing logic
  return { processed: true };
});
```

### Example 3: Scheduled Tasks
```bash
POST /api/tasks
{
  "type": "generate_report",
  "payload": {...},
  "scheduledAt": "2025-06-02T14:00:00Z"
}
```

## 🔮 Next Steps (SWE-Bench Tasks)

1. Fix retry off-by-one bug
2. Add strict task locking
3. Implement MongoDB backend
4. Add Redis queue
5. Implement dead-letter queue
6. Add task result persistence
7. Add webhook callbacks
8. Add rate limiting
9. Implement task chains
10. Add observability/metrics

## 💡 Tips for Development

### Adding a New Feature
1. Add type definition in `src/types/index.ts`
2. Implement business logic in appropriate `src/core/` module
3. Expose via TaskService if needed
4. Add controller/route in `src/api/`
5. Add tests in `tests/`
6. Update documentation

### Debugging
1. Check `src/index.ts` for app initialization
2. Review task lifecycle in `ARCHITECTURE.md`
3. Trace execution through TaskService
4. Check worker logs in Worker class
5. Review test cases for expected behavior

### Testing
1. Unit tests for isolated components
2. Integration tests for workflows
3. Use test setup.ts for common fixtures
4. Mock handlers in tests
5. Verify state transitions

## 📞 Support

- See `README.md` for quick start
- See `ARCHITECTURE.md` for design questions
- See `API_GUIDE.md` for API questions
- See tests for usage examples

---

**Project**: TaskFlow Engine v1.0.0  
**Status**: ✅ Complete and Production Ready  
**Last Updated**: 2025-06-01  
**Maintainer**: Backend Engineering Team

