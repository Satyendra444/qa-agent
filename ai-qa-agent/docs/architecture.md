# Architecture — AI Agent & MCP Testing Framework

## 1. System Design

The framework transforms a single natural-language requirement into a fully
executed Playwright test suite, structured evaluation report, and observability
dashboard — without manual intervention.

### Technology Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript 5 (strict mode) |
| Agent Orchestration | LangGraph (`@langchain/langgraph`) |
| Browser Automation | Playwright (via MCP Server) |
| LLM Client | OpenAI-compatible (`openai` SDK) |
| Web Framework | Express.js |
| Database | PostgreSQL 15 |
| Testing | Vitest |
| Property Testing | fast-check |
| LLM Evaluation | Promptfoo |
| Containerisation | Docker + Docker Compose |
| MCP Integration | `@modelcontextprotocol/sdk` |

### Component Responsibilities

| Component | Responsibility |
|---|---|
| `OrchestratorAgent` | Session management; LangGraph state machine; sub-agent coordination |
| `RequirementAgent` | Raw requirement → structured scenarios + acceptance criteria |
| `TestCaseAgent` | Scenarios → positive / negative / edge test cases |
| `AutomationAgent` | Test cases → Playwright TypeScript scripts (POM pattern) |
| `ExecutionAgent` | Playwright execution; artifact collection; structured results |
| `EvaluationAgent` | Metric computation; hallucination detection; evaluation report |
| `MCPServerManager` | Connection, discovery, retry, timeout, schema validation for MCP servers |
| `MCPTestingFramework` | Contract, schema, security, and concurrency testing of MCP tools |
| `AgentEvaluationFramework` | Reusable metric evaluation across sessions |
| `ReportGenerator` | Self-contained HTML session reports |
| Observability Dashboard | Web UI: session list, drill-down, time-series charts |
| Express REST API | `POST /api/sessions`, `GET /api/sessions/:id`, report endpoint |

---

## 2. High-Level Architecture Diagram

```mermaid
graph TD
    User -->|POST /api/sessions| API[Express.js REST API]
    API --> Orchestrator
    Orchestrator -->|LangGraph state machine| Pipeline

    subgraph Pipeline
        RA[Requirement_Agent]
        TCA[TestCase_Agent]
        AA[Automation_Agent]
        EA[Execution_Agent]
        EVA[Evaluation_Agent]
        RA --> TCA --> AA --> EA --> EVA
    end

    Orchestrator --> SessionStore[(PostgreSQL)]
    Pipeline --> MCPManager[MCP_Server_Manager]

    subgraph MCP_Servers
        PlaywrightMCP[Playwright MCP Server]
        FileSysMCP[File System MCP Server]
        PGMCP[PostgreSQL MCP Server]
        GitHubMCP[GitHub MCP Server]
    end

    MCPManager --> PlaywrightMCP
    MCPManager --> FileSysMCP
    MCPManager --> PGMCP
    MCPManager --> GitHubMCP

    EVA --> EvalFW[Agent_Evaluation_Framework]
    MCPManager --> TestFW[MCP_Testing_Framework]
    SessionStore --> Dashboard[Observability Dashboard /dashboard]
    EVA --> Reports[HTML Report /reports]
    API -->|GET /api/sessions/:id/report| Reports
```

---

## 3. End-to-End Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant API as Express API
    participant Orch as Orchestrator
    participant RA as Requirement_Agent
    participant TCA as TestCase_Agent
    participant AA as Automation_Agent
    participant EA as Execution_Agent
    participant EVA as Evaluation_Agent
    participant MCP as MCP_Server_Manager
    participant DB as PostgreSQL

    U->>API: POST /api/sessions { requirement }
    API->>Orch: startSession(requirement)
    Orch-->>API: { sessionId }
    API-->>U: 202 { sessionId }

    Orch->>DB: persist session (status: pending)
    Orch->>RA: extractScenarios(requirement)
    RA->>MCP: fs.write(scenarios.json)
    RA-->>Orch: { scenarios, criteria }

    Orch->>TCA: generateTestCases(scenarios)
    TCA->>MCP: fs.write(testcases.json)
    TCA-->>Orch: { testCases[] }

    par Automation (parallel per test case)
        Orch->>AA: generateScript(testCase)
        AA->>MCP: fs.write(*.spec.ts)
        AA-->>Orch: { scriptPath }
    end

    par Execution (parallel per script)
        Orch->>EA: executeScript(scriptPath)
        EA->>MCP: playwright.run(scriptPath)
        EA->>MCP: pg.insert(results)
        EA-->>Orch: { testResult }
    end

    Orch->>EVA: evaluate(sessionLog)
    EVA->>MCP: pg.insert(evalReport)
    EVA->>MCP: fs.write(evalReport.json)
    EVA-->>Orch: { metrics, hallucinations }

    Orch->>DB: persist session (status: completed)
    Orch->>MCP: fs.write(report-{sessionId}.html)

    U->>API: GET /api/sessions/:sessionId
    API-->>U: { status: completed, outputs }

    U->>API: GET /api/sessions/:sessionId/report
    API-->>U: text/html report
```

---

## 4. Folder Structure

```
ai-qa-agent/
├── src/
│   ├── agents/
│   │   ├── orchestrator/
│   │   │   ├── index.ts          # OrchestratorAgent
│   │   │   ├── graph.ts          # LangGraph StateGraph
│   │   │   └── state.ts          # PipelineState type + factory
│   │   ├── requirement/
│   │   │   └── index.ts          # RequirementAgent
│   │   ├── testcase/
│   │   │   └── index.ts          # TestCaseAgent
│   │   ├── automation/
│   │   │   ├── index.ts          # AutomationAgent
│   │   │   └── pom-template.ts   # POM template generator
│   │   ├── execution/
│   │   │   └── index.ts          # ExecutionAgent
│   │   └── evaluation/
│   │       └── index.ts          # EvaluationAgent
│   ├── mcp/
│   │   ├── manager/
│   │   │   ├── index.ts          # MCPServerManager
│   │   │   ├── connection.ts     # MCPConnection
│   │   │   ├── registry.ts       # ToolRegistry
│   │   │   └── retry.ts          # Exponential backoff utility
│   │   └── testing/
│   │       ├── index.ts          # MCPTestingFramework
│   │       ├── contract.ts       # ContractValidator
│   │       ├── schema.ts         # SchemaValidator
│   │       ├── security.ts       # SecurityTester
│   │       └── concurrency.ts    # ConcurrencyTester
│   ├── evals/
│   │   ├── index.ts              # AgentEvaluationFramework
│   │   ├── metrics.ts            # Pure metric functions
│   │   ├── hallucination.ts      # HallucinationDetector
│   │   └── deepeval.ts           # DeepEval/Promptfoo adapter
│   ├── api/
│   │   ├── server.ts             # Express app factory
│   │   ├── routes/
│   │   │   ├── sessions.ts       # Session + dashboard endpoints
│   │   │   └── reports.ts        # Report download endpoint
│   │   └── middleware/
│   │       ├── error.ts          # Global error handler
│   │       └── logger.ts         # Request logger
│   ├── dashboards/
│   │   ├── server.ts             # Dashboard router
│   │   └── public/
│   │       ├── index.html        # SPA shell
│   │       ├── charts.js         # Chart.js rendering
│   │       └── styles.css        # Styles
│   ├── reports/
│   │   └── generator.ts          # HTML report builder
│   ├── logging/
│   │   ├── logger.ts             # ILogger + ConsoleLogger
│   │   └── persistence.ts        # PostgreSQL log writer
│   ├── db/
│   │   ├── client.ts             # pg Pool wrapper
│   │   └── migrations/
│   │       └── 001_initial.sql   # Initial schema
│   ├── shared/
│   │   ├── types.ts              # All shared interfaces
│   │   └── config.ts             # Environment variable loader
│   └── index.ts                  # Application entry point
├── tests/
│   ├── unit/                     # Vitest unit tests
│   └── integration/
│       └── mcp/                  # Real-MCP integration tests
├── evals/
│   └── fixtures/                 # Sample logs + reference data
├── docs/
│   └── architecture.md           # This file
├── docker/
│   ├── Dockerfile                # Multi-stage production image
│   └── init.sql                  # PostgreSQL init (copy of 001_initial.sql)
├── reports/                      # Runtime HTML report output
├── workspace/                    # File System MCP workspace
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI pipeline
├── .husky/
│   ├── pre-commit                # lint-staged
│   └── commit-msg                # commitlint
├── docker-compose.yml            # Full stack (dev)
├── docker-compose.test.yml       # Infrastructure only (CI)
├── .env.example                  # Documented env template
├── .gitignore
├── .prettierrc
├── .prettierignore
├── eslint.config.js
├── tsconfig.json
├── tsconfig.test.json
├── vitest.config.ts
└── package.json
```

---

## 5. Implementation Roadmap

| Phase | Name | Objectives | Key Deliverables |
|---|---|---|---|
| 1 | Architecture & Setup | Document system design; scaffold project | `docs/architecture.md`, `package.json`, `tsconfig.json`, `docker-compose.yml`, `.env.example`, `README.md` |
| 2 | MCP Server Manager | MCP connections, tool discovery, retry, schema validation | `src/mcp/manager/` (retry, registry, connection, manager) |
| 3 | Single-Agent MVP | Logger, RequirementAgent, Orchestrator, REST API | `src/logging/`, `src/agents/requirement/`, `src/agents/orchestrator/`, `src/api/` |
| 4 | Full Multi-Agent Pipeline | All 5 agents wired into LangGraph state machine | `src/agents/testcase/`, `src/agents/automation/`, `src/agents/execution/`, `src/agents/evaluation/`, `src/agents/orchestrator/graph.ts` |
| 5 | MCP Testing Framework | Contract, schema, security, concurrency testing | `src/mcp/testing/` |
| 6 | Agent Evaluation Framework | Metrics, hallucination detection, DeepEval adapter | `src/evals/` |
| 7 | Observability & Reports | Dashboard UI, metric charts, HTML report generation | `src/dashboards/`, `src/reports/` |
| 8 | CI/CD & Quality | Coverage ≥ 80%, integration tests, Docker image, CI pipeline | `.github/workflows/ci.yml`, `docker/Dockerfile`, `evals/fixtures/` |
