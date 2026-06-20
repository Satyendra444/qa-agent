import { randomUUID } from 'crypto';
import type { ILogger } from '@logging/logger.js';
import type { MCPServerManager } from '@mcp/manager/index.js';
import type { QAAgentState, QAReport } from './types.js';
import { InMemoryAgentMemory } from './memory.js';
import type { IAgentMemory } from './memory.js';
import { buildGraph } from './graph.js';

export interface QAAgentConfig {
  serverId: string;
  maxStageRetries?: number;
}

export class QAAgent {
  private readonly _memory: IAgentMemory;
  private readonly _graph: ReturnType<typeof buildGraph>;

  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _logger: ILogger,
    private readonly _config: QAAgentConfig,
    memory?: IAgentMemory,
  ) {
    this._memory = memory ?? new InMemoryAgentMemory();
    this._graph = buildGraph(_manager, this._memory, _logger, _config.serverId);
  }

  async run(task: string): Promise<QAReport> {
    const sessionId = randomUUID();
    const startedAt = new Date().toISOString();

    this._logger.info(sessionId, 'qa.agent', 'session.start', { task }, {}, 0);

    let state: QAAgentState = {
      sessionId,
      task,
      stage: 'plan',
      plannedActions: [],
      executedActions: [],
      validations: [],
      retryCount: {},
      errors: [],
      startedAt,
      report: null,
    };

    const stages: Array<keyof ReturnType<typeof buildGraph>> = [
      'plan',
      'execute',
      'validate',
      'report',
    ];

    for (const stageName of stages) {
      const maxRetries = this._config.maxStageRetries ?? 2;
      let stageAttempt = 0;

      while (stageAttempt <= maxRetries) {
        try {
          state = await this._graph[stageName](state);
          break;
        } catch (err) {
          stageAttempt++;
          const errMsg = err instanceof Error ? err.message : String(err);
          this._logger.error(
            sessionId,
            'qa.agent',
            `Stage '${stageName}' failed (attempt ${stageAttempt}): ${errMsg}`,
            [errMsg],
          );

          if (stageAttempt > maxRetries) {
            state = {
              ...state,
              stage: 'failed',
              errors: [...state.errors, `Stage '${stageName}' failed after ${stageAttempt} attempts: ${errMsg}`],
            };
            break;
          }
        }
      }

      if (state.stage === 'failed') break;
    }

    if (!state.report) {
      const now = new Date().toISOString();
      state.report = {
        sessionId,
        task,
        status: 'failed',
        startedAt,
        completedAt: now,
        durationMs: Date.now() - new Date(startedAt).getTime(),
        actions: state.executedActions,
        validations: state.validations,
        summary: `Task failed: ${state.errors.join('; ')}`,
        errors: state.errors,
      };
    }

    this._memory.store(
      InMemoryAgentMemory.makeEntry(sessionId, task, state.plannedActions, state.report),
    );

    this._logger.info(
      sessionId,
      'qa.agent',
      'session.complete',
      { task },
      {
        status: state.report.status,
        durationMs: state.report.durationMs,
        actionsRun: state.executedActions.length,
        validationsRun: state.validations.length,
      },
      state.report.durationMs,
    );

    return state.report;
  }

  get memory(): IAgentMemory {
    return this._memory;
  }
}
