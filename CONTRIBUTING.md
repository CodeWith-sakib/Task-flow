# Contributing to TaskFlow Engine

Thank you for your interest in contributing to TaskFlow Engine!

## Development Guidelines

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Quality Gate
Before submitting pull requests or committing code, ensure the mandatory three-point verification gate passes:

```bash
# 1. Type check
npm run lint

# 2. Build
npm run build

# 3. Test Suite
npm test
```

Zero warnings and zero errors are strictly required.

### Code Style & Architecture
- Code should be placed in appropriate subsystem directories (`src/storage`, `src/queue`, `src/workflows`, etc.).
- Never rely on live network sockets in unit and integration tests. Use the in-memory simulator (`tests/api/httpSimulator.ts`).
- Ensure all time arithmetic utilizes UTC to maintain determinism across timezones.
