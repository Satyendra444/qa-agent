import { randomUUID } from 'crypto';
import type { PipelineState } from '@shared/types.js';
import type { Session } from '@shared/types.js';

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

export function createSession(requirement: string): Session {
  return {
    sessionId: randomUUID(),
    status: 'pending',
    requirement,
    currentAgent: null,
    outputs: {},
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
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

export const MAX_STAGE_RETRIES = 2;
