# Test Structure

This project uses a mixed strategy:

- `src/**`: colocated unit/component tests (`*.test.ts`, `*.test.tsx`)
- `test/integration/**`: cross-module integration tests
- `test/e2e/**`: end-to-end style tests and scripts

Keep fast, deterministic tests in `src/**` whenever possible.
