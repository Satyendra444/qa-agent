import type { ILogger } from '@logging/logger.js';
import type { TestCase, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';
import { generatePageObject } from './pom-template.js';

export interface AutomationOutput {
  scriptPaths: string[];
  pomPaths: string[];
}

export type AutomationResult = AutomationOutput | AgentError;

function extractPageName(step: string): string | null {
  const match = step.match(/on (?:the )?([A-Z][a-zA-Z]+)\s*(?:page|screen|view|component)?/);
  return match?.[1] ?? null;
}

function buildTestScript(testCase: TestCase, pomClass: string, scriptPath: string): string {
  const steps = testCase.steps.map((s) => `    // ${s}`).join('\n');
  return [
    `import { test, expect } from '@playwright/test';`,
    `import { ${pomClass} } from './${pomClass}.js';`,
    ``,
    `test.use({ screenshot: 'only-on-failure', video: 'on', trace: 'on' });`,
    ``,
    `test('${testCase.title}', async ({ page }) => {`,
    `  const pom = new ${pomClass}(page);`,
    steps,
    `  // TODO: add assertions based on: ${testCase.expectedResult}`,
    `  expect(page).toBeDefined();`,
    `});`,
  ].join('\n');
}

export class AutomationAgent {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
  ) {}

  async generate(testCases: TestCase[]): Promise<AutomationResult> {
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return { error: 'INVALID_INPUT', reason: 'testCases must be a non-empty array' };
    }

    const start = Date.now();
    const scriptPaths: string[] = [];
    const pomPaths: string[] = [];
    const generatedPoms = new Set<string>();

    for (const tc of testCases) {
      // Derive page name from test case title or steps
      const pageName = tc.steps.reduce<string | null>((found, step) => found ?? extractPageName(step), null)
        ?? (tc.title.split(' ').find((w) => w.length > 4) ?? 'App');
      const pomClass = `${pageName}Page`;

      if (!generatedPoms.has(pomClass)) {
        const pomSource = generatePageObject({
          className: pomClass,
          selectors: {
            body: 'body',
            heading: 'h1',
            submitButton: 'button[type="submit"]',
          },
          actions: ['clickSubmit', 'waitForLoad'],
        });

        const pomPath = `sessions/${this._sessionId}/${pomClass}.ts`;
        await this._writeFile(pomPath, pomSource);
        pomPaths.push(pomPath);
        generatedPoms.add(pomClass);
      }

      const scriptSource = buildTestScript(tc, pomClass, `sessions/${this._sessionId}`);
      const scriptPath = `sessions/${this._sessionId}/${tc.id}.spec.ts`;
      await this._writeFile(scriptPath, scriptSource);
      scriptPaths.push(scriptPath);
    }

    const latency = Date.now() - start;
    this._logger.info(
      this._sessionId, 'automation.agent', 'generate',
      { testCaseCount: testCases.length },
      { scriptCount: scriptPaths.length, pomCount: pomPaths.length },
      latency,
    );

    return { scriptPaths, pomPaths };
  }

  private async _writeFile(path: string, content: string): Promise<void> {
    if (!this._manager.isServerAvailable('filesystem')) return;
    try {
      await this._manager.callTool('filesystem', 'write_file', { path, content }, this._sessionId);
    } catch (err) {
      this._logger.warn(this._sessionId, 'automation.agent', `Failed to write ${path}: ${String(err)}`);
    }
  }
}
