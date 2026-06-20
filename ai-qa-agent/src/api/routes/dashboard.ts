import { Router } from 'express';
import { query } from '@db/client.js';

function parseString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function createDashboardApiRouter(): Router {
  const router = Router();

  router.get('/sessions', async (req, res) => {
    const status = parseString(req.query.status);
    const from = parseString(req.query.from);
    const to = parseString(req.query.to);

    const clauses: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }
    if (from) {
      params.push(from);
      clauses.push(`started_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      clauses.push(`started_at <= $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query<{
      session_id: string;
      status: string;
      requirement: string;
      started_at: string;
      completed_at: string | null;
    }>(
      `SELECT session_id, status, requirement, started_at, completed_at
       FROM sessions
       ${where}
       ORDER BY started_at DESC
       LIMIT 200`,
      params,
    );

    const sessions = result.rows.map((row) => ({
      sessionId: row.session_id,
      status: row.status,
      requirement: row.requirement,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.completed_at ? new Date(row.completed_at).getTime() - new Date(row.started_at).getTime() : null,
    }));

    res.json(sessions);
  });

  router.get('/metrics', async (req, res) => {
    const agent = parseString(req.query.agent);
    const tool = parseString(req.query.tool);
    const status = parseString(req.query.status);
    const from = parseString(req.query.from);
    const to = parseString(req.query.to);

    const clauses: string[] = [`timestamp >= NOW() - INTERVAL '90 days'`];
    const params: unknown[] = [];

    if (agent) {
      params.push(agent);
      clauses.push(`agent = $${params.length}`);
    }
    if (tool) {
      params.push(tool);
      clauses.push(`tool = $${params.length}`);
    }
    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }
    if (from) {
      params.push(from);
      clauses.push(`timestamp >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      clauses.push(`timestamp <= $${params.length}`);
    }

    const where = `WHERE ${clauses.join(' AND ')}`;
    const metrics = await query<{
      session_id: string;
      status: string;
      agent: string;
      tool: string;
      latency: number;
      tokens: number;
      cost: number;
      timestamp: string;
    }>(
      `SELECT session_id, status, agent, tool, latency, tokens, cost, timestamp
       FROM agent_logs
       ${where}
       ORDER BY timestamp DESC
       LIMIT 1000`,
      params,
    );

    res.json(metrics.rows);
  });

  router.get('/session/:sessionId/logs', async (req, res) => {
    const { sessionId } = req.params as { sessionId: string };
    const result = await query<{
      timestamp: string;
      agent: string;
      tool: string;
      input: unknown;
      output: unknown;
      latency: number;
      status: string;
      tokens: number;
      cost: number;
      errors: unknown;
    }>(
      `SELECT timestamp, agent, tool, input, output, latency, status, tokens, cost, errors
       FROM agent_logs
       WHERE session_id = $1
       ORDER BY timestamp ASC`,
      [sessionId],
    );

    res.json(result.rows.map((row) => ({
      timestamp: row.timestamp,
      agent: row.agent,
      tool: row.tool,
      input: row.input,
      output: row.output,
      latency: row.latency,
      status: row.status,
      tokens: row.tokens,
      cost: row.cost,
      errors: row.errors,
    })));
  });

  return router;
}
