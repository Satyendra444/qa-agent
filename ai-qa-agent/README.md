# AI Agent & MCP Testing Framework

An open-source, end-to-end proof-of-concept that transforms a single
natural-language requirement into a fully executed Playwright test suite,
structured evaluation report, and observability dashboard.

See **[docs/architecture.md](docs/architecture.md)** for the complete system
design, component responsibilities, and implementation roadmap.

---

## Overview

The system orchestrates a pipeline of five specialised AI agents via a
LangGraph state machine:

```
Requirement_Agent → TestCase_Agent → Automation_Agent → Execution_Agent → Evaluation_Agent
```

MCP (Model Context Protocol) servers handle all I/O: browser automation
(Playwright), file persistence (File System), database (PostgreSQL), and source
control (GitHub). No MCP functionality is re-implemented — the framework builds
only testing, evaluation, and observability on top.

---

## Prerequisites

| Software | Version |
|---|---|
| Node.js | ≥ 20.0.0 |
| npm | ≥ 10.0.0 (bundled with Node 20) |
| Docker | ≥ 24.0.0 |
| Docker Compose | ≥ 2.20.0 (included in Docker Desktop) |
| Git | ≥ 2.40.0 |

---

## Quick Start

### 1 — Clone

```bash
git clone <repo-url> ai-qa-agent
cd ai-qa-agent
```

### 2 — Install dependencies

```bash
npm install
```

### 3 — Configure

```bash
cp .env.example .env
# Open .env and set at minimum:
#   OPENAI_API_KEY=<your-key>
#   DATABASE_URL=postgresql://postgres:password@localhost:5432/qa_agent
```

### 4 — Start infrastructure (Docker Compose)

```bash
docker compose up -d
```

All services (PostgreSQL, Playwright MCP, File System MCP, PostgreSQL MCP,
GitHub MCP) start on the `qa-net` bridge network. The `app` service is also
started, listening on **http://localhost:3000**.

Wait for everything to be healthy:

```bash
docker compose ps
# All services should show "healthy" after ~30 s
```

### 5 — Run without Docker (development)

```bash
# Requires DATABASE_URL pointing to a running PostgreSQL instance
npm run dev
```

### 6 — Run tests

```bash
# Unit tests
npm run test:unit

# Unit tests with coverage (target ≥ 80%)
npm run test:unit:coverage

# Integration tests (requires Docker Compose services running)
npm run test:integration
```

### 7 — Type check + lint + format

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run format:check # Prettier
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sessions` | Submit a requirement; returns `{ sessionId }` |
| `GET` | `/api/sessions/:sessionId` | Poll session status |
| `GET` | `/api/sessions/:sessionId/report` | Download HTML report |
| `GET` | `/dashboard` | Observability dashboard |
| `GET` | `/health` | Health check (used by Docker) |

**Submit a requirement:**

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"requirement": "As a user I want to log in with email and password so that I can access my account"}'
# → { "sessionId": "..." }
```

**Poll status:**

```bash
curl http://localhost:3000/api/sessions/<sessionId>
# → { "sessionId": "...", "status": "running", "currentAgent": "TestCaseAgent", ... }
```

---

## Project Structure

```
ai-qa-agent/
├── src/              # All TypeScript source
│   ├── agents/       # Five AI agents + orchestrator
│   ├── mcp/          # MCP manager + testing framework
│   ├── evals/        # Agent evaluation framework
│   ├── api/          # Express REST API
│   ├── dashboards/   # Observability dashboard
│   ├── reports/      # HTML report generator
│   ├── logging/      # Structured logger
│   ├── db/           # PostgreSQL client + migrations
│   └── shared/       # Types + config
├── tests/            # Vitest tests (unit + integration)
├── evals/fixtures/   # Sample session logs + reference data
├── docs/             # Architecture documentation
├── docker/           # Dockerfile + init.sql
└── reports/          # Runtime HTML output (git-ignored)
```

---

## Implementation Status

The project skeleton is complete. Each `src/` module contains a typed stub with
a `TODO (task N.N)` comment indicating where the business logic is implemented.
Phases are executed in order — see
[docs/architecture.md](docs/architecture.md#5-implementation-roadmap) for the
full roadmap.

---

## Contributing

1. Create a feature branch from `develop`
2. Make changes — Husky runs `lint-staged` on commit
3. Open a pull request targeting `develop`
4. CI must pass (type check + lint + format + unit tests) before merge
