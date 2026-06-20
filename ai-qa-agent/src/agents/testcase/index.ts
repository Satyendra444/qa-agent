import type { ILogger } from '@logging/logger.js';
import type { Scenario, TestCase, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';

export interface TestCaseOutput {
  testCases: TestCase[];
}

export type TestCaseResult = TestCaseOutput | AgentError;

function isValidScenarioList(scenarios: unknown): scenarios is Scenario[] {
  return (
    Array.isArray(scenarios) &&
    scenarios.length > 0 &&
    (scenarios as Scenario[]).every(
      (s) => typeof s.id === 'string' && typeof s.title === 'string' && Array.isArray(s.acceptanceCriteria),
    )
  );
}

function generateCasesForScenario(scenario: Scenario, baseIndex: number): TestCase[] {
  const makeId = (type: string, n: number) => `tc-${scenario.id}-${type}-${n}`;

  const positive: TestCase = {
    id: makeId('pos', baseIndex),
    title: `[Positive] ${scenario.title}`,
    type: 'positive',
    preconditions: ['System is accessible', 'User has valid credentials'],
    steps: [
      `Navigate to the feature described by: "${scenario.description}"`,
      ...scenario.acceptanceCriteria.map((c) => `Verify: ${c}`),
    ],
    expectedResult: `All acceptance criteria are met: ${scenario.acceptanceCriteria.join('; ')}`,
  };

  const negative: TestCase = {
    id: makeId('neg', baseIndex),
    title: `[Negative] ${scenario.title} — invalid input`,
    type: 'negative',
    preconditions: ['System is accessible'],
    steps: [
      `Navigate to the feature described by: "${scenario.description}"`,
      'Submit with invalid or missing required inputs',
    ],
    expectedResult: 'System displays an appropriate validation error and does not proceed',
  };

  const edge: TestCase = {
    id: makeId('edge', baseIndex),
    title: `[Edge] ${scenario.title} — boundary conditions`,
    type: 'edge',
    preconditions: ['System is accessible'],
    steps: [
      `Navigate to the feature described by: "${scenario.description}"`,
      ...scenario.edgeCases.map((ec) => `Test edge case: ${ec}`),
    ],
    expectedResult: 'System handles all edge cases gracefully without crashing or data loss',
  };

  return [positive, negative, edge];
}

export class TestCaseAgent {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
  ) {}

  async generate(scenarios: Scenario[]): Promise<TestCaseResult> {
    if (!isValidScenarioList(scenarios)) {
      return {
        error: 'INVALID_INPUT',
        reason: 'Input must be a non-empty array of well-formed Scenario objects with id, title, and acceptanceCriteria',
      };
    }

    const start = Date.now();
    const testCases: TestCase[] = [];

    scenarios.forEach((scenario, i) => {
      testCases.push(...generateCasesForScenario(scenario, i + 1));
    });

    const latency = Date.now() - start;

    this._logger.info(
      this._sessionId, 'testcase.agent', 'generate',
      { scenarioCount: scenarios.length },
      { testCaseCount: testCases.length },
      latency,
    );

    await this._persistOutput(testCases);

    return { testCases };
  }

  private async _persistOutput(testCases: TestCase[]): Promise<void> {
    if (!this._manager.isServerAvailable('filesystem')) return;
    try {
      await this._manager.callTool(
        'filesystem', 'write_file',
        {
          path: `sessions/${this._sessionId}/testcases.json`,
          content: JSON.stringify({ testCases }, null, 2),
        },
        this._sessionId,
      );
    } catch (err) {
      this._logger.warn(this._sessionId, 'testcase.agent', `Failed to persist test cases: ${String(err)}`);
    }
  }
}
