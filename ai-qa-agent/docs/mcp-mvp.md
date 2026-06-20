# Phase 2 MVP — Playwright MCP Server Integration

## What's implemented

| Component | File | Status |
|---|---|---|
| Exponential backoff retry | `src/mcp/manager/retry.ts` | ✅ |
| Tool registry | `src/mcp/manager/registry.ts` | ✅ |
| MCP connection wrapper | `src/mcp/manager/connection.ts` | ✅ |
| MCP server manager | `src/mcp/manager/index.ts` | ✅ |
| Structured logger | `src/logging/logger.ts` | ✅ |
| Demo script | `src/mcp/playwright-demo.ts` | ✅ |
| Unit tests | `tests/unit/mcp/` + `tests/unit/logging/` | ✅ |
| Integration tests | `tests/integration/mcp/playwright.test.ts` | ✅ |

---

## Prerequisites

```bash
# Node 20+
node --version

# Install project dependencies
npm install

# Install Playwright browsers (needed by the MCP server)
npx playwright install --with-deps chromium
```

---

## Run the demo

Connects to Playwright MCP, lists all tools, navigates to `https://example.com`, and takes a screenshot:

```bash
npx tsx src/mcp/playwright-demo.ts
```

Expected output:

```
{"timestamp":"...","sessionId":"demo-session","agent":"demo","tool":"startup",...}

=== Available Playwright MCP tools ===
  • browser_navigate — Navigate to a URL
  • browser_screenshot — Take a screenshot
  • browser_click — Click an element
  ...

=== Navigating to https://example.com ===
Navigation result: { ... }

=== Taking a screenshot ===
Screenshot captured (data length: ... chars)

Demo complete.
```

---

## Run unit tests

No external services required:

```bash
npm run test:unit
```

Coverage:

```bash
npm run test:unit:coverage
```

---

## Run integration tests

Requires `@playwright/mcp` to be runnable via `npx`:

```bash
npm run test:integration
```

The integration suite:
1. Connects to a real Playwright MCP server process (stdio transport)
2. Verifies tool discovery (`browser_navigate`, `browser_screenshot`, etc.)
3. Executes `browser_navigate` against `https://example.com`
4. Executes `browser_screenshot`
5. Validates the structured log entry emitted for each tool call

---

## Architecture

### Connection flow

```
MCPServerManager.connect()
  └─ for each config → new MCPConnection(config, logger)
       └─ MCPConnection.connect()
            ├─ creates MCP SDK Client
            ├─ creates StdioClientTransport (npx @playwright/mcp)
            ├─ races connect() vs 10s timeout
            └─ on success → MCPServerManager._discoverTools()
                 └─ client.listTools() → ToolRegistry.register(serverId, schema)
```

### Tool call flow

```
MCPServerManager.callTool(serverId, toolName, input, sessionId)
  ├─ lookup MCPConnection by serverId
  ├─ withExponentialBackoff(
  │    fn: conn.callTool(toolName, input) vs 30s timeout,
  │    maxAttempts: 3, baseDelay: 1000ms, isTransient: ECONNRESET/ETIMEDOUT/503
  │  )
  └─ logger.log({ timestamp, sessionId, agent, tool, input, output, latency, status, ... })
```

### Retry policy

| Error type | Behaviour |
|---|---|
| `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `socket hang up`, `network timeout` | Transient — retry up to 3× with backoff: 1s → 2s → 4s |
| HTTP 503-equivalent (`{ statusCode: 503 }`) | Transient — same policy |
| All other errors | Permanent — re-throw immediately, no retry |
| Timeout (30s tool call, 10s connection) | Throws timeout error — treated as transient |
