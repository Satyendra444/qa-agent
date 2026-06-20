import type { ILogger } from '@logging/logger.js';
import type { Scenario, AgentError } from '@shared/types.js';
import type { MCPServerManager } from '@mcp/manager/index.js';

export interface RequirementOutput {
  scenarios: Scenario[];
  extractionIncomplete?: true;
}

export type RequirementResult = RequirementOutput | (AgentError & { extractionIncomplete?: true });

const MIN_WORDS = 10;
const VERB_OBJECT_RE = /\b(open|navigate|visit|validate|check|verify|click|submit|enter|login|test|create|update|delete|search|view|display|show|load|get|post|send)\b.{2,}/i;

function isValidInput(requirement: string): boolean {
  const words = requirement.trim().split(/\s+/);
  return words.length >= MIN_WORDS && VERB_OBJECT_RE.test(requirement);
}

function buildScenarioExtractionPrompt(requirement: string): string {
  return `You are a QA engineer. Extract functional test scenarios from the requirement below.

Return ONLY a valid JSON object in this exact shape:
{
  "scenarios": [
    {
      "id": "scenario-1",
      "title": "short title",
      "description": "what to test",
      "acceptanceCriteria": ["criterion 1", "criterion 2"],
      "edgeCases": ["edge case 1"]
    }
  ]
}

Requirement: "${requirement}"`;
}

export class RequirementAgent {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _sessionId: string,
    private readonly _llmClient?: {
      chat(prompt: string): Promise<{ content: string; tokensUsed: number }>;
    },
  ) {}

  async analyze(requirement: string): Promise<RequirementResult> {
    if (!isValidInput(requirement)) {
      return {
        error: 'INVALID_INPUT',
        reason: `Requirement must be at least ${MIN_WORDS} words and describe a testable behavior with a verb-object pair. Got: "${requirement}"`,
      };
    }

    if (!this._llmClient) {
      return this._extractWithHeuristic(requirement);
    }

    const start = Date.now();
    let tokensUsed = 0;

    try {
      const prompt = buildScenarioExtractionPrompt(requirement);
      const response = await this._llmClient.chat(prompt);
      tokensUsed = response.tokensUsed;
      const latency = Date.now() - start;

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this._logger.error(this._sessionId, 'requirement.agent', 'LLM returned non-JSON response');
        return { error: 'LLM_FAILURE', reason: 'LLM response did not contain valid JSON' };
      }

      let parsed: { scenarios?: Scenario[] };
      try {
        parsed = JSON.parse(jsonMatch[0]) as { scenarios?: Scenario[] };
      } catch {
        return { error: 'LLM_FAILURE', reason: 'Failed to parse LLM JSON response' };
      }

      this._logger.info(
        this._sessionId, 'requirement.agent', 'analyze',
        { requirement },
        { scenarioCount: parsed.scenarios?.length ?? 0 },
        latency, tokensUsed,
      );

      await this._persistOutput(requirement, parsed.scenarios ?? []);

      if (!parsed.scenarios || parsed.scenarios.length === 0) {
        return { scenarios: [], extractionIncomplete: true };
      }

      return { scenarios: parsed.scenarios };
    } catch (err) {
      const latency = Date.now() - start;
      this._logger.error(this._sessionId, 'requirement.agent', String(err));
      this._logger.log({
        timestamp: new Date().toISOString(), sessionId: this._sessionId,
        agent: 'requirement.agent', tool: 'llm.chat',
        input: { requirement }, output: {},
        latency, status: 'error', tokens,
        cost: 0,
        errors: [String(err)],
      });
      return { error: 'LLM_FAILURE', reason: String(err) };
    }
  }

  private _extractWithHeuristic(requirement: string): RequirementResult {
    const lowerReq = requirement.toLowerCase();
    const scenarioId = `scenario-${Date.now()}`;
    const words = requirement.split(/\s+/);

    const scenario: Scenario = {
      id: scenarioId,
      title: words.slice(0, 6).join(' '),
      description: requirement,
      acceptanceCriteria: [
        `The system should successfully: ${requirement}`,
      ],
      edgeCases: [
        'Invalid or missing input values',
        'Network failure during operation',
        lowerReq.includes('login') ? 'Invalid credentials submitted' : 'Unexpected server response',
      ],
    };

    this._logger.info(
      this._sessionId, 'requirement.agent', 'analyze.heuristic',
      { requirement }, { scenarioCount: 1 }, 0,
    );

    return { scenarios: [scenario] };
  }

  private async _persistOutput(requirement: string, scenarios: Scenario[]): Promise<void> {
    if (!this._manager.isServerAvailable('filesystem')) return;

    try {
      await this._manager.callTool(
        'filesystem', 'write_file',
        {
          path: `sessions/${this._sessionId}/scenarios.json`,
          content: JSON.stringify({ requirement, scenarios }, null, 2),
        },
        this._sessionId,
      );
    } catch (err) {
      this._logger.warn(this._sessionId, 'requirement.agent', `Failed to persist scenarios: ${String(err)}`);
    }
  }
}
