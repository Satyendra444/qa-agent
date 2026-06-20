import fs from 'fs/promises';
import type { MCPTestReport } from './index.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class MCPTestReporter {
  static renderHtml(report: MCPTestReport): string {
    const sections = [
      ['Server', escapeHtml(report.serverId)],
      ['Tool count', String(report.toolCount)],
      ['Generated', escapeHtml(report.generatedAt)],
      ['Contract passed', String(report.contractTests.passed)],
      ['Contract failed', String(report.contractTests.failed)],
      ['Functional executed', String(report.functional.executed)],
      ['Functional successful', String(report.functional.successful)],
      ['Functional failed', String(report.functional.failed)],
      ['Throughput (ops/sec)', report.performance.throughputPerSecond.toFixed(2)],
      ['Average latency (ms)', report.performance.averageLatencyMs.toFixed(2)],
    ];

    const failureRows = report.functional.failures
      .map((failure) => `<li>${escapeHtml(failure.toolName)}: ${escapeHtml(failure.reason)}</li>`)
      .join('');

    const invalidRows = report.negativeTests.invalidParams
      .filter((check) => !check.passed)
      .map((check) => `<li>${escapeHtml(check.toolName)}: ${escapeHtml(check.reason ?? 'unknown')}</li>`)
      .join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MCP Test Report — ${escapeHtml(report.serverId)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 32px; color: #111; }
    h1, h2 { border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
    pre { background: #f7f7f7; padding: 16px; overflow-x: auto; }
    section { margin-bottom: 24px; }
    ul { margin: 0; padding-left: 1.25rem; }
  </style>
</head>
<body>
  <h1>MCP Test Report — ${escapeHtml(report.serverId)}</h1>
  <p>Generated at ${escapeHtml(report.generatedAt)}</p>
  <section>
    <h2>Summary</h2>
    <dl>
      ${sections.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}
    </dl>
  </section>
  <section>
    <h2>Functional failures</h2>
    <ul>${failureRows || '<li>None</li>'}</ul>
  </section>
  <section>
    <h2>Negative invalid parameter failures</h2>
    <ul>${invalidRows || '<li>None</li>'}</ul>
  </section>
  <section>
    <h2>Full JSON</h2>
    <pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>
  </section>
</body>
</html>`;
  }

  static async writeJson(filePath: string, report: MCPTestReport): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
  }

  static async writeHtml(filePath: string, report: MCPTestReport): Promise<void> {
    await fs.writeFile(filePath, this.renderHtml(report), 'utf8');
  }
}
