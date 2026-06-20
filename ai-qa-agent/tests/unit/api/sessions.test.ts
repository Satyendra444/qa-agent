import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/api/server.js';
import type { OrchestratorAgent } from '../../../src/agents/orchestrator/index.js';
import type { ILogger } from '../../../src/logging/logger.js';

function makeLogger(): ILogger {
  return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeOrchestrator(sessionId = 'test-session-id'): OrchestratorAgent {
  return {
    startSession: vi.fn().mockResolvedValue(sessionId),
    getSession: vi.fn().mockResolvedValue({
      sessionId,
      status: 'pending',
      requirement: 'test requirement',
      currentAgent: null,
      outputs: {},
      errors: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
    }),
    updateSession: vi.fn(),
  } as unknown as OrchestratorAgent;
}

describe('POST /api/sessions', () => {
  it('returns 202 with sessionId for valid requirement', async () => {
    const app = createApp(makeOrchestrator(), './reports', makeLogger());
    const res = await request(app)
      .post('/api/sessions')
      .send({ requirement: 'Open the website and validate the login page form' });

    expect(res.status).toBe(202);
    expect(typeof res.body.sessionId).toBe('string');
  });

  it('returns 400 when requirement is missing', async () => {
    const app = createApp(makeOrchestrator(), './reports', makeLogger());
    const res = await request(app).post('/api/sessions').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_REQUEST');
  });

  it('returns 400 when requirement is empty string', async () => {
    const app = createApp(makeOrchestrator(), './reports', makeLogger());
    const res = await request(app).post('/api/sessions').send({ requirement: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when requirement is not a string', async () => {
    const app = createApp(makeOrchestrator(), './reports', makeLogger());
    const res = await request(app).post('/api/sessions').send({ requirement: 42 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/sessions/:sessionId', () => {
  it('returns 200 with session for known sessionId', async () => {
    const app = createApp(makeOrchestrator('known-id'), './reports', makeLogger());
    const res = await request(app).get('/api/sessions/known-id');

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('known-id');
    expect(res.body.status).toBe('pending');
  });

  it('returns 404 with SESSION_NOT_FOUND for unknown sessionId', async () => {
    const orchestrator = makeOrchestrator();
    (orchestrator.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createApp(orchestrator, './reports', makeLogger());

    const res = await request(app).get('/api/sessions/UNKNOWN-SESSION');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('SESSION_NOT_FOUND');
    expect(res.body.sessionId).toBe('UNKNOWN-SESSION');
  });
});

describe('GET /health', () => {
  it('returns 200 OK', async () => {
    const app = createApp(makeOrchestrator(), './reports', makeLogger());
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
