# QA Agent Architecture

## Overview

The QA Agent accepts a natural-language task (e.g. "Open a website and validate
login page"), plans a sequence of browser actions via a LangGraph-style state
machine, executes them through the Playwright MCP Server, validates results, and
returns a structured execution report.

---

## Component Diagram

```mermaid
graph TD
    User["User\n'Open website & validate login page'"]
    QAAgent["QAAgent\nsrc/agents/qa/index.ts"]
    Memory["InMemoryAgentMemory\nsrc/agents/qa/memory.ts"]
    Planner["Planner\nsrc/agents/qa/planner.ts"]
    Graph["StateGraph\nsrc/agents/qa/graph.ts"]
    Validator["Validator\nsrc/agents/qa/validator.ts"]
    Manager["MCPServerManager\nsrc/mcp/manager/index.ts"]
    Retry["withExponentialBackoff\nsrc/mcp/manager/retry.ts"]
    PlaywrightMCP["Playwright MCP Server\n(npx @playwright/mcp)"]
    Logger["ConsoleLogger\nsrc/logging/logger.ts"]
    Report["QAReport\n(returned to caller)"]

    User -->|task string| QAAgent
    QAAgent --> Memory
    QAAgent --> Graph
    Graph -->|plan stage| Planner
    Graph -->|execute stage| Manager
    Graph -->|validate stage| Validator
    Graph -->|report stage| Report
    Manager --> Retry
    Retry --> PlaywrightMCP
    Graph --> Logger
    Manager --> Logger
```

---

## LangGraph State Machine

The agent runs through four sequential stages. Each stage can retry up to
`maxStageRetries` times (default: 2) before transitioning to `failed`.

```mermaid
stateDiagram-v2
    [*] --> plan
    plan --> execute : actions planned
    plan --> failed : retries exhausted
    execute --> validate : all actions attempted
    execute --> report : critical failure
    validate --> report : checks complete
    report --> completed : report built
    completed --> [*]
    failed --> [*]
```

### Stage responsibilities

| Stage | Responsibility |
|---|---|
| **plan** | Interprets task, queries available MCP tools, builds `PlannedAction[]`. Checks memory for similar prior tasks. |
| **execute** | Runs each action via `MCPServerManager.callTool()` with retry + timeout. Collects `ActionResult[]`. |
| **validate** | Runs text checks (keyword presence in page content) and structural checks (form field detection via `browser_evaluate`). |
| **report** | Aggregates results into a `QAReport`. Sets `status`: `passed` / `partial` / `failed`. Stores result in memory. |

---

## Sequence Diagram — "Validate Login Page"

```mermaid
sequenceDiagram
    participant U as User
    participant A as QAAgent
    participant M as InMemoryAgentMemory
    participant G as StateGraph
    participant P as Planner
    participant Mgr as MCPServerManager
    participant PW as Playwright MCP Server
    participant V as Validator
    participant L as Logger

    U->>A: run("Open website & validate login page")
    A->>M: findSimilarTask(task)
    M-->>A: prior task (or undefined)
    A->>G: invoke(initialState)

    rect rgb(230, 245, 255)
        note over G,P: Stage 1 — Plan
        G->>P: planActions(task, availableTools)
        P-->>G: PlannedAction[]
        G->>L: log plan.complete
    end

    rect rgb(230, 255, 230)
        note over G,PW: Stage 2 — Execute
        loop for each PlannedAction
            G->>Mgr: callTool(serverId, toolName, input, sessionId)
            Mgr->>PW: MCP tool call (with retry + timeout)
            PW-->>Mgr: tool result
            Mgr-->>G: ActionResult
            G->>L: log action result
        end
    end

    rect rgb(255, 245, 230)
        note over G,V: Stage 3 — Validate
        G->>V: runTextValidations(specs, results)
        V-->>G: ValidationCheck[] (keyword presence)
        G->>V: runStructuralValidation(results)
        V-->>G: ValidationCheck[] (form elements)
        G->>L: log validate.complete
    end

    rect rgb(245, 230, 255)
        note over G: Stage 4 — Report
        G->>G: build QAReport
        G->>L: log report.complete
    end

    G-->>A: final state
    A->>M: store(sessionId, task, actions, report)
    A-->>U: QAReport
```

---

## Sequence Diagram — Retry Flow

```mermaid
sequenceDiagram
    participant G as StateGraph (execute)
    participant Mgr as MCPServerManager
    participant R as withExponentialBackoff
    participant PW as Playwright MCP

    G->>Mgr: callTool("browser_navigate", ...)
    Mgr->>R: withExponentialBackoff(fn, 3, 1000ms)

    R->>PW: attempt 1
    PW-->>R: ECONNRESET (transient)
    R->>R: wait 1000ms

    R->>PW: attempt 2
    PW-->>R: ECONNRESET (transient)
    R->>R: wait 2000ms

    R->>PW: attempt 3
    PW-->>R: success
    R-->>Mgr: result
    Mgr-->>G: ActionResult { status: "success", attempt: 3 }
```

---

## Agent Memory

`InMemoryAgentMemory` is a circular buffer (default max 100 entries).

- **Store**: after every `run()` completion
- **Lookup**: at the start of `plan` stage — finds prior task with ≥50% keyword
  overlap
- **Effect**: the planner logs a `memory.hit` entry when a similar prior task is
  found, which can inform future plan refinement

```
Memory {
  entries: [
    { sessionId, task, actions: PlannedAction[], report: QAReport, timestamp }
    ...
  ]
}
```

---

## Retry Policy

| Layer | Max attempts | Base delay | Transient errors |
|---|---|---|---|
| MCP tool call (`MCPServerManager`) | 3 | 1000ms (doubles: 1s→2s→4s) | ECONNRESET, ETIMEDOUT, ECONNREFUSED, socket hang up, HTTP 503 |
| QA Agent stage | 2 (configurable) | immediate | any `Error` thrown by a stage node |

---

## QAReport Shape

```typescript
interface QAReport {
  sessionId: string;       // UUID per run
  task: string;            // original user input
  status: 'passed' | 'failed' | 'partial';
  startedAt: string;       // ISO8601
  completedAt: string;     // ISO8601
  durationMs: number;
  actions: ActionResult[]; // one per planned action
  validations: ValidationCheck[];
  summary: string;         // human-readable one-liner
  errors: string[];        // stage/action error messages
}
```

**Status rules:**
- `passed` — all actions succeeded AND all validations passed AND no errors
- `failed` — all actions failed OR (errors present AND no validations passed)
- `partial` — some actions/validations passed, some failed

---

## File Structure

```
src/agents/qa/
├── index.ts       QAAgent — entry point, stage orchestration, memory store
├── types.ts       All QA-specific TypeScript interfaces
├── memory.ts      InMemoryAgentMemory — circular buffer with similarity search
├── planner.ts     Task → PlannedAction[] (keyword-based tool selection)
├── graph.ts       Four stage nodes: plan / execute / validate / report
├── validator.ts   Text + structural validation of execution results
└── demo.ts        Runnable demo script
```
