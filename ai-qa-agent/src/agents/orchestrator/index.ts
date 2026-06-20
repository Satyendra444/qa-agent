import type { ILogger } from '@logging/logger.js';
import type { Session } from '@shared/types.js';import { createSession } from './state.js';

export interface ISessionStore {
  save(session: Session): Promise<void>;
  findById(sessionId: string): Promise<Session | null>;
  update(sessionId: string, patch: Partial<Session>): Promise<void>;
}

export class InMemorySessionStore implements ISessionStore {
  private readonly _sessions = new Map<string, Session>();

  async save(session: Session): Promise<void> {
    this._sessions.set(session.sessionId, { ...session });
  }

  async findById(sessionId: string): Promise<Session | null> {
    return this._sessions.get(sessionId) ?? null;
  }

  async update(sessionId: string, patch: Partial<Session>): Promise<void> {
    const existing = this._sessions.get(sessionId);
    if (!existing) return;
    this._sessions.set(sessionId, { ...existing, ...patch });
  }

  get size(): number {
    return this._sessions.size;
  }
}

export class OrchestratorAgent {
  constructor(
    private readonly _sessionStore: ISessionStore,
    private readonly _logger: ILogger,
  ) {}

  async startSession(requirement: string): Promise<string> {
    const session = createSession(requirement);
    await this._sessionStore.save(session);

    this._logger.info(
      session.sessionId,
      'orchestrator',
      'session.start',
      { requirement },
      { sessionId: session.sessionId, status: 'pending' },
      0,
    );

    return session.sessionId;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this._sessionStore.findById(sessionId);
  }

  async updateSession(sessionId: string, patch: Partial<Session>): Promise<void> {
    await this._sessionStore.update(sessionId, patch);
  }
}
