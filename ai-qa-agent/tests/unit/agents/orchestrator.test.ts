import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestratorAgent, InMemorySessionStore } from '../../../src/agents/orchestrator/index.js';
import type { ILogger } from '../../../src/logging/logger.js';

function makeLogger(): ILogger {
  return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('InMemorySessionStore', () => {
  it('saves and retrieves a session', async () => {
    const store = new InMemorySessionStore();
    const session = {
      sessionId: 'sess-1', status: 'pending' as const, requirement: 'test',
      currentAgent: null, outputs: {}, errors: [],
      startedAt: new Date().toISOString(), completedAt: null,
    };
    await store.save(session);
    const found = await store.findById('sess-1');
    expect(found?.sessionId).toBe('sess-1');
  });

  it('returns null for unknown sessionId', async () => {
    const store = new InMemorySessionStore();
    expect(await store.findById('nonexistent')).toBeNull();
  });

  it('updates a session field', async () => {
    const store = new InMemorySessionStore();
    const session = {
      sessionId: 's1', status: 'pending' as const, requirement: 'req',
      currentAgent: null, outputs: {}, errors: [],
      startedAt: new Date().toISOString(), completedAt: null,
    };
    await store.save(session);
    await store.update('s1', { status: 'running' });
    const updated = await store.findById('s1');
    expect(updated?.status).toBe('running');
  });
});

describe('OrchestratorAgent', () => {
  let store: InMemorySessionStore;
  let agent: OrchestratorAgent;
  let logger: ILogger;

  beforeEach(() => {
    store = new InMemorySessionStore();
    logger = makeLogger();
    agent = new OrchestratorAgent(store, logger);
  });

  it('startSession returns a non-empty sessionId', async () => {
    const id = await agent.startSession('test requirement with enough words here');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('startSession creates a unique sessionId each time', async () => {
    const id1 = await agent.startSession('req one with enough words to be valid');
    const id2 = await agent.startSession('req two with enough words to be valid');
    expect(id1).not.toBe(id2);
  });

  it('startSession persists session with status pending', async () => {
    const id = await agent.startSession('validate login page form on website');
    const session = await store.findById(id);
    expect(session?.status).toBe('pending');
    expect(session?.requirement).toBe('validate login page form on website');
  });

  it('getSession returns the session', async () => {
    const id = await agent.startSession('open website and check login page form');
    const session = await agent.getSession(id);
    expect(session?.sessionId).toBe(id);
  });

  it('getSession returns null for unknown id', async () => {
    expect(await agent.getSession('nonexistent')).toBeNull();
  });

  it('startSession logs a session.start entry', async () => {
    await agent.startSession('test requirement with enough words to meet minimum');
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      'orchestrator',
      'session.start',
      expect.objectContaining({ requirement: expect.any(String) }),
      expect.any(Object),
      0,
    );
  });
});
