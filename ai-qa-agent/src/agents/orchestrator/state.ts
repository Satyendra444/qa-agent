import type { PipelineState } from '@shared/types.js';

export function createInitialState(sessionId: string, requirement: string): PipelineState {
  return {
    sessionId,
    requirement,
    scenarios: [],
    testCases: [],
    scriptPaths: [],
    executionResult: null,
    evaluationReport: null,
    errors: [],
    retryCount: {},
  };
}

export const PIPELINE_STAGES = [
  'RequirementExtraction',
  'TestCaseGeneration',
  'AutomationGeneration',
  'Execution',
  'Evaluation',
  'ReportGeneration',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Maximum retries per stage before transitioning to `Failed`. */
export const MAX_STAGE_RETRIES = 2;
