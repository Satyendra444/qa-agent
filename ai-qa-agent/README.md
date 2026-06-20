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

### 4 — Start the Docker daemon (macOS)

This project requires a running Docker daemon for the Compose stack.

If you use Docker Desktop:

- Open Docker Desktop and wait until the daemon is running.

If you do not have Docker Desktop, install Colima:

```bash
brew install colima
colima start --cpu 2 --memory 4 --disk 60
```

Confirm the daemon is running:

```bash
docker info
```

If your system does not support `docker compose`, use the fallback:

```bash
docker-compose --version
```

### 5 — Start infrastructure (Docker Compose)

```bash
docker compose up -d
```

If necessary, use the legacy CLI:

```bash
docker-compose up -d
```

All services (PostgreSQL, Playwright MCP, File System MCP, PostgreSQL MCP,
GitHub MCP) start on the `qa-net` bridge network. The `app` service listens on
**http://localhost:3000**.

Wait for everything to be healthy:

```bash
docker compose ps
# or docker-compose ps
```

### 6 — Run the app locally (development)

If you want to run only the application and connect to a PostgreSQL instance,
use:

```bash
npm run dev
```

Open the dashboard in a browser:

- http://localhost:3000/dashboard

### 7 — Use the prompt-driven demo workflow

1. Edit `demo/requirement.txt` with your requirement.
2. Use `demo/prompts/requirement-agent.md` to extract structured scenarios.
3. Use `demo/prompts/testcase-agent.md` to convert scenarios into test cases.
4. Use `demo/prompts/automation-agent.md` to generate a Playwright script.
5. Use `demo/prompts/execution-agent.md` to execute the script and collect a result.

### 8 — Example: NoteStly homepage validation

Requirement example:

```text
Verify the NoteStly homepage title and description. The page title should be "NoteStly" and the meta description should include "modern note-taking".
```

Prompt example for the requirement agent:

```text
You are an AI requirement agent. Transform the following user requirement into a small set of test scenarios.

Requirement:
Verify the NoteStly homepage title and description. The page title should be "NoteStly" and the meta description should include "modern note-taking".
```

Expected scenarios:

- Verify the homepage title is "NoteStly"
- Verify the homepage meta description contains "modern note-taking"

Prompt example for the testcase agent:

```text
You are an AI test case generator. Convert the following scenarios into explicit test cases with a name and expected outcome.

Scenarios:
- Verify the homepage title is "NoteStly"
- Verify the homepage meta description contains "modern note-taking"
```

Expected test cases:

- `Homepage title is NoteStly`
- `Homepage meta description contains modern note-taking`

Prompt example for the automation agent:

```text
You are an AI automation engineer. Generate a Playwright TypeScript script that performs the given test cases.

Test cases:
- Homepage title is NoteStly
- Homepage meta description contains modern note-taking

Output only the final Playwright TypeScript code.
```

The generated automation should:

- open the NoteStly homepage URL `https://www.notesly.in/`
- assert `document.title === "NoteStly"`
- assert the meta description contains `"modern note-taking"`
- capture any failures and screenshots if supported

Prompt example for the execution agent:

```text
You are an AI execution agent. Run the generated Playwright script and return a structured result with pass/fail status, actions taken, and any error details.
```

This flow shows how a single natural-language requirement becomes:

1. structured scenarios
2. explicit test cases
3. generated Playwright automation
4. executed results and a QA report

### 9 — Example cURL flow

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"requirement": "Verify the NoteStly homepage title and description. The page title should be \"NoteStly\" and the meta description should include \"modern note-taking\"."}'
```

Then poll session status:

```bash
curl http://localhost:3000/api/sessions/<sessionId>
```

And open the dashboard:

```text
http://localhost:3000/dashboard
```

### 10 — Run tests

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
├── demo/             # End-to-end prompt and sample demo artifacts
└── reports/          # Runtime HTML output (git-ignored)
```

---

## Demo Assets

The `demo/` directory contains a reusable end-to-end proof-of-concept asset set for the AI QA pipeline:

- `requirement.txt` — sample requirement used as demo input.
- `prompts/` — prompt templates for each pipeline agent stage.
- `sample-output.json` — expected session output format for a completed demo run.
- `sample-report.md` — human-readable summary of a demo session.

See `demo/README.md` for instructions and example flow.

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
# qa-agent
