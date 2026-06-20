import type { PipelineState } from '@shared/types.js';
import type { ILogger } from '@logging/logger.js';
import type { RequirementAgent } from '@agents/requirement/index.js';
import type { TestCaseAgent } from '@agents/testcase/index.js';
import type { AutomationAgent } from '@agents/automation/index.js';
import type { ExecutionAgent } from '@agents/execution/index.js';
import type { EvaluationAgent } from '@agents/evaluation/index.js';
import type { ReportGenerator } from '@reports/generator.js';

export type PipelineNode = (state: PipelineState) => Promise<Partial<PipelineState>>;

export interface PipelineGraph {
  invoke(state: PipelineState): Promise<PipelineState>;
}

type StageName =
  | 'RequirementExtraction'
  | 'TestCaseGeneration'
  | 'AutomationGeneration'
  | 'Execution'
  | 'Evaluation'
  | 'ReportGeneration';

const MAX_RETRIES = 2;

function makeRetryingNode(
  stageName: StageName,
  fn: PipelineNode,
  logger: ILogger,
): PipelineNode {
  return async (state: PipelineState): Promise<Partial<PipelineState>> => {
    const retries = state.retryCount[stageName] ?? 0;

    try {
      const patch = await fn(state);
      logger.info(
        state.sessionId, 'orchestrator.graph', `stage.complete.${stageName}`,
        {}, {}, 0,
      );
      return patch;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(state.sessionId, 'orchestrator.graph', `stage.error.${stageName}: ${msg}`);

      if (retries < MAX_RETRIES) {
        return {
          retryCount: { ...state.retryCount, [stageName]: retries + 1 },
          errors: [...state.errors, { stage: stageName, message: msg }],
        };
      }

      return {
        errors: [
          ...state.errors,
          { stage: stageName, message: `${stageName} failed after ${MAX_RETRIES + 1} attempts: ${msg}` },
        ],
        retryCount: { ...state.retryCount, [stageName]: retries + 1 },
      };
    }
  };
}

export interface AgentDependencies {
  requirementAgent: RequirementAgent;
  testCaseAgent: TestCaseAgent;
  automationAgent: AutomationAgent;
  executionAgent: ExecutionAgent;
  evaluationAgent: EvaluationAgent;
  reportGenerator: ReportGenerator;
}

export function buildPipelineGraph(
  agents: AgentDependencies,
  logger: ILogger,
): PipelineGraph {
  const nodes: Record<StageName, PipelineNode> = {
    RequirementExtraction: makeRetryingNode('RequirementExtraction', async (state) => {
      const result = await agents.requirementAgent.analyze(state.requirement);
      if ('error' in result) {
        return { errors: [...state.errors, { stage: 'RequirementExtraction', message: result.reason }] };
      }
      return { scenarios: result.scenarios };
    }, logger),

    TestCaseGeneration: makeRetryingNode('TestCaseGeneration', async (state) => {
      const result = await agents.testCaseAgent.generate(state.scenarios);
      if ('error' in result) {
        return { errors: [...state.errors, { stage: 'TestCaseGeneration', message: result.reason }] };
      }
      return { testCases: result.testCases };
    }, logger),

    AutomationGeneration: makeRetryingNode('AutomationGeneration', async (state) => {
      const result = await agents.automationAgent.generate(state.testCases);
      if ('error' in result) {
        return { errors: [...state.errors, { stage: 'AutomationGeneration', message: result.reason }] };
      }
      return { scriptPaths: result.scriptPaths };
    }, logger),

    Execution: makeRetryingNode('Execution', async (state) => {
      const result = await agents.executionAgent.execute(state.scriptPaths);
      if ('error' in result) {
        return { errors: [...state.errors, { stage: 'Execution', message: result.reason }] };
      }
      return { executionResult: result };
    }, logger),

    Evaluation: makeRetryingNode('Evaluation', async (state) => {
      if (!state.executionResult) {
        return { errors: [...state.errors, { stage: 'Evaluation', message: 'No execution result available' }] };
      }
      const result = await agents.evaluationAgent.evaluate(
        state.executionResult, state.requirement,
      );
      if ('error' in result) {
        return { errors: [...state.errors, { stage: 'Evaluation', message: result.reason }] };
      }
      return { evaluationReport: result };
    }, logger),

    ReportGeneration: makeRetryingNode('ReportGeneration', async (state) => {
      try {
        await agents.reportGenerator.generate(state);
      } catch (err) {
        logger.error(state.sessionId, 'orchestrator.graph', `ReportGeneration failed (non-blocking): ${String(err)}`);
      }
      return {};
    }, logger),
  };

  const stageOrder: StageName[] = [
    'RequirementExtraction',
    'TestCaseGeneration',
    'AutomationGeneration',
    'Execution',
    'Evaluation',
    'ReportGeneration',
  ];

  return {
    async invoke(initialState: PipelineState): Promise<PipelineState> {
      let state = { ...initialState };

      for (const stageName of stageOrder) {
        const node = nodes[stageName];
        const patch = await node(state);
        state = { ...state, ...patch };

        const retries = state.retryCount[stageName] ?? 0;
        const stageErrors = state.errors.filter((e) => e.stage === stageName);

        if (retries > 0 && stageErrors.length > 0 && retries <= MAX_RETRIES) {
          logger.info(
            state.sessionId, 'orchestrator.graph', `stage.retry.${stageName}`,
            { attempt: retries }, {}, 0,
          );
          const patch2 = await node(state);
          state = { ...state, ...patch2 };
        }
      }

      return state;
    },
  };
}
