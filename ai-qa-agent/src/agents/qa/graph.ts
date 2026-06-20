import type { ILogger } from '@logging/logger.js';
import type { MCPServerManager } from '@mcp/manager/index.js';
import type { QAAgentState, PlannedAction, ActionResult, QAReport, QAStage } from './types.js';
import type { IAgentMemory } from './memory.js';
import { planActions, buildLoginValidations } from './planner.js';
import { runTextValidations, runStructuralValidation } from './validator.js';
import { withExponentialBackoff, defaultIsTransient } from '@mcp/manager/retry.js';

export const MAX_ACTION_RETRIES = 3;
export const ACTION_BASE_DELAY_MS = 1000;

type NodeFn = (state: QAAgentState) => Promise<QAAgentState>;

interface NodeMap {
  plan: NodeFn;
  execute: NodeFn;
  validate: NodeFn;
  report: NodeFn;
}

function nextStage(state: QAAgentState): QAStage {
  if (state.errors.length > 0 && state.stage === 'execute') return 'report';
  const flow: QAStage[] = ['plan', 'execute', 'validate', 'report', 'completed'];
  const idx = flow.indexOf(state.stage);
  return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1]! : 'completed';
}

export function buildGraph(
  manager: MCPServerManager,
  memory: IAgentMemory,
  logger: ILogger,
  serverId: string,
): NodeMap {
  // ── Plan node ─────────────────────────────────────────────────────────────
  const plan: NodeFn = async (state) => {
    logger.info(state.sessionId, 'qa.plan', 'plan.start', { task: state.task }, {}, 0);

    const prior = memory.findSimilarTask(state.task);
    if (prior) {
      logger.info(
        state.sessionId,
        'qa.plan',
        'memory.hit',
        { priorTask: prior.task },
        { actionsReused: prior.actions.length },
        0,
      );
    }

    const tools = manager.getAvailableTools(serverId);
    const { actions, reasoning } = planActions(state.task, tools, serverId);

    logger.info(
      state.sessionId,
      'qa.plan',
      'plan.complete',
      { task: state.task },
      { actionCount: actions.length, reasoning },
      0,
    );

    return { ...state, plannedActions: actions, stage: nextStage({ ...state, stage: 'plan' }) };
  };

  // ── Execute node ──────────────────────────────────────────────────────────
  const execute: NodeFn = async (state) => {
    const executed: ActionResult[] = [];
    const errors: string[] = [...state.errors];

    for (const action of state.plannedActions) {
      const result = await executeAction(action, state.sessionId, manager, logger);
      executed.push(result);

      if (result.status === 'failure') {
        errors.push(`Action ${action.id} (${action.toolName}) failed: ${result.error ?? 'unknown'}`);
        logger.warn(state.sessionId, 'qa.execute', `Action failed: ${action.toolName}`, {
          actionId: action.id,
          error: result.error,
        });
      }
    }

    const nextSt = nextStage({ ...state, stage: 'execute' });
    return { ...state, executedActions: executed, errors, stage: nextSt };
  };

  // ── Validate node ─────────────────────────────────────────────────────────
  const validate: NodeFn = async (state) => {
    logger.info(state.sessionId, 'qa.validate', 'validate.start', {}, {}, 0);

    const textSpecs = buildLoginValidations(state.task);
    const textChecks = runTextValidations(textSpecs, state.executedActions);
    const structChecks = runStructuralValidation(state.executedActions);
    const validations = [...textChecks, ...structChecks];

    const failed = validations.filter((v) => !v.passed);
    if (failed.length > 0) {
      logger.warn(state.sessionId, 'qa.validate', `${failed.length} validation(s) failed`, {
        failed: failed.map((v) => v.name),
      });
    }

    logger.info(
      state.sessionId,
      'qa.validate',
      'validate.complete',
      {},
      { total: validations.length, passed: validations.filter((v) => v.passed).length },
      0,
    );

    return { ...state, validations, stage: nextStage({ ...state, stage: 'validate' }) };
  };

  // ── Report node ───────────────────────────────────────────────────────────
  const report: NodeFn = async (state) => {
    const completedAt = new Date().toISOString();
    const startMs = new Date(state.startedAt).getTime();
    const durationMs = Date.now() - startMs;

    const allPassed = state.validations.length > 0 && state.validations.every((v) => v.passed);
    const anyPassed = state.validations.some((v) => v.passed);
    const hasExecErrors = state.errors.length > 0;
    const executionOk = state.executedActions.some((a) => a.status === 'success');

    let overallStatus: 'passed' | 'failed' | 'partial';
    if (!executionOk || (hasExecErrors && !anyPassed)) {
      overallStatus = 'failed';
    } else if (allPassed && !hasExecErrors) {
      overallStatus = 'passed';
    } else {
      overallStatus = 'partial';
    }

    const passedCount = state.validations.filter((v) => v.passed).length;
    const totalCount = state.validations.length;
    const execPassed = state.executedActions.filter((a) => a.status === 'success').length;
    const execTotal = state.executedActions.length;

    const summary = [
      `Task: "${state.task}"`,
      `Overall: ${overallStatus.toUpperCase()}`,
      `Actions: ${execPassed}/${execTotal} succeeded`,
      totalCount > 0 ? `Validations: ${passedCount}/${totalCount} passed` : '',
      state.errors.length > 0 ? `Errors: ${state.errors.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const qaReport: QAReport = {
      sessionId: state.sessionId,
      task: state.task,
      status: overallStatus,
      startedAt: state.startedAt,
      completedAt,
      durationMs,
      actions: state.executedActions,
      validations: state.validations,
      summary,
      errors: state.errors,
    };

    logger.info(
      state.sessionId,
      'qa.report',
      'report.complete',
      { task: state.task },
      { status: overallStatus, summary },
      durationMs,
    );

    return { ...state, report: qaReport, stage: 'completed' };
  };

  return { plan, execute, validate, report };
}

async function executeAction(
  action: PlannedAction,
  sessionId: string,
  manager: MCPServerManager,
  logger: ILogger,
): Promise<ActionResult> {
  const start = Date.now();

  logger.info(sessionId, 'qa.execute', `action.start.${action.toolName}`, action.input, {}, 0);

  let attempt = 0;

  try {
    const callFn = async (): Promise<unknown> => {
      attempt++;
      const { result } = await manager.callTool(
        action.serverId,
        action.toolName,
        action.input,
        sessionId,
      );
      return result;
    };

    const output = await withExponentialBackoff(
      callFn,
      MAX_ACTION_RETRIES,
      ACTION_BASE_DELAY_MS,
      defaultIsTransient,
    );

    const latencyMs = Date.now() - start;
    logger.info(
      sessionId,
      'qa.execute',
      `action.success.${action.toolName}`,
      action.input,
      typeof output === 'object' && output !== null
        ? (output as Record<string, unknown>)
        : { result: output },
      latencyMs,
    );

    return {
      actionId: action.id,
      toolName: action.toolName,
      input: action.input,
      output,
      status: 'success',
      latencyMs,
      attempt,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    logger.error(sessionId, 'qa.execute', `action.failed.${action.toolName}`, [errorMsg]);

    return {
      actionId: action.id,
      toolName: action.toolName,
      input: action.input,
      output: null,
      status: errorMsg.toLowerCase().includes('timeout') ? 'timeout' : 'failure',
      latencyMs,
      error: errorMsg,
      attempt,
    };
  }
}
