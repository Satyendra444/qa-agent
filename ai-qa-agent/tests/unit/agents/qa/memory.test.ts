import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAgentMemory } from '../../../../src/agents/qa/memory.js';
import type { QAReport, PlannedAction } from '../../../../src/agents/qa/types.js';

function makeReport(sessionId = 'sess-1'): QAReport {
  return {
    sessionId,
    task: 'test task',
    status: 'passed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 100,
    actions: [],
    validations: [],
    summary: 'ok',
    errors: [],
  };
}

const NO_ACTIONS: PlannedAction[] = [];

describe('InMemoryAgentMemory', () => {
  let memory: InMemoryAgentMemory;

  beforeEach(() => {
    memory = new InMemoryAgentMemory(50);
  });

  it('starts empty', () => {
    expect(memory.size).toBe(0);
  });

  it('stores and retrieves entries', () => {
    memory.store(InMemoryAgentMemory.makeEntry('s1', 'login page test', NO_ACTIONS, makeReport()));
    expect(memory.size).toBe(1);
  });

  it('getLast returns most recent N entries', () => {
    for (let i = 0; i < 5; i++) {
      memory.store(InMemoryAgentMemory.makeEntry(`s${i}`, `task ${i}`, NO_ACTIONS, makeReport(`s${i}`)));
    }
    const last2 = memory.getLast(2);
    expect(last2).toHaveLength(2);
    expect(last2[1]?.task).toBe('task 4');
  });

  it('getByTask filters by keyword', () => {
    memory.store(InMemoryAgentMemory.makeEntry('s1', 'validate login page', NO_ACTIONS, makeReport()));
    memory.store(InMemoryAgentMemory.makeEntry('s2', 'check dashboard', NO_ACTIONS, makeReport('s2')));
    const results = memory.getByTask('login');
    expect(results).toHaveLength(1);
    expect(results[0]?.task).toBe('validate login page');
  });

  it('findSimilarTask returns entry with >50% word overlap', () => {
    memory.store(InMemoryAgentMemory.makeEntry('s1', 'open website and validate login page', NO_ACTIONS, makeReport()));
    const match = memory.findSimilarTask('open website validate login');
    expect(match).toBeDefined();
    expect(match?.task).toContain('login');
  });

  it('findSimilarTask returns undefined when no similar task', () => {
    memory.store(InMemoryAgentMemory.makeEntry('s1', 'check shopping cart', NO_ACTIONS, makeReport()));
    const match = memory.findSimilarTask('validate login credentials');
    expect(match).toBeUndefined();
  });

  it('respects maxSize by evicting oldest entries', () => {
    memory = new InMemoryAgentMemory(3);
    for (let i = 0; i < 5; i++) {
      memory.store(InMemoryAgentMemory.makeEntry(`s${i}`, `task ${i}`, NO_ACTIONS, makeReport(`s${i}`)));
    }
    expect(memory.size).toBe(3);
    const last = memory.getLast(3);
    expect(last[0]?.sessionId).toBe('s2');
    expect(last[2]?.sessionId).toBe('s4');
  });

  it('clear empties memory', () => {
    memory.store(InMemoryAgentMemory.makeEntry('s1', 'task', NO_ACTIONS, makeReport()));
    memory.clear();
    expect(memory.size).toBe(0);
  });
});
