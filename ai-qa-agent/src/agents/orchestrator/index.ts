import type { ILogger } from '@logging/logger.js';
import type { Session } from '@shared/types.js';

export interface ISessionStore {
  save(session: Session): Promise<void>;
  findById(sessionId: string): Promise<Session | null>;
  update(sessionId: string, patch: Partial<Session>): Promise<void>;
}

export class OrchestratorAgent {
  constructor(
    private readonly _sessionStore: ISessionStore,
    private readonly _logger: ILogger,
  ) {}

  async startSession(_requirement: string): Promise<string> {
    throw new Error('OrchestratorAgent.startSession() not yet implemented — see task 11.2');
  }

  async getSession(_sessionId: string): Promise<Session | null> {
    throw new Error('OrchestratorAgent.getSession() not yet implemented — see task 11.2');
  }
}
