# MCP Testing Framework

This document describes the automated testing framework for MCP Servers in the `ai-qa-agent` repository.

## Goals

The MCP testing framework is built to verify the behavior, schema compliance, performance, and security of MCP servers and their published tools.

It includes:

- Functional tests for tool discovery and tool execution
- Contract tests for input schema correctness and output schema conformance
- Negative tests for invalid parameters, missing parameters, and unauthorized requests
- Performance tests for concurrent execution, latency, and throughput
- Security tests for prompt injection, command injection, and data leakage

## Architecture

The framework is implemented under `src/mcp/testing/`:

- `index.ts` — orchestrates the full test suite and builds the report structure
- `contract.ts` — validates tool input schemas and schema definitions
- `schema.ts` — validates output schemas and error handling behavior
- `functional.ts` — verifies tool discovery and execution behavior
- `negative.ts` — checks invalid input handling and unauthorized request behavior
- `performance.ts` — benchmarks latency, throughput, and concurrency
- `security.ts` — probes common injection patterns and secret leakage risks
- `report.ts` — renders JSON and HTML test results

The test runner exposes `MCPTestingFramework` so integration tests and ad hoc workflows can execute a full MCP verification suite.

## Runner and Reports

The integration test suite is located in `tests/integration/mcp/` and exercises the framework against a live Playwright MCP server.

Report generation is handled by `src/mcp/testing/report.ts`, which emits both JSON and HTML summaries. The HTML report includes a read-only summary, failure details, and the complete JSON payload.

## Usage

After verifying that the MCP server is available, run the suite with:

```bash
npm run test:integration
```

The framework is designed to be extended with additional probes and server-specific test cases without modifying the core orchestration logic.
