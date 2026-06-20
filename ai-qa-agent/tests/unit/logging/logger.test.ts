import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsoleLogger } from '../../../src/logging/logger.js';

describe('ConsoleLogger', () => {
  let logger: ConsoleLogger;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new ConsoleLogger();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  it('log() writes a single JSON line to stdout', () => {
    const entry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      sessionId: 'sess-1',
      agent: 'test',
      tool: 'my_tool',
      input: { a: 1 },
      output: { b: 2 },
      latency: 42,
      status: 'success',
      tokensUsed: 10,
      errors: [],
    };
    logger.log(entry);
    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(entry) + '\n');
  });

  it('info() emits entry with status "success"', () => {
    logger.info('sess-1', 'agent', 'tool', { in: 1 }, { out: 2 }, 100, 5);
    const written = String((writeSpy.mock.calls[0] as [string])[0]);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed['status']).toBe('success');
    expect(parsed['sessionId']).toBe('sess-1');
    expect(parsed['latency']).toBe(100);
    expect(parsed['tokensUsed']).toBe(5);
  });

  it('info() defaults tokensUsed to 0', () => {
    logger.info('s', 'a', 't', {}, {}, 0);
    const written = String((writeSpy.mock.calls[0] as [string])[0]);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed['tokensUsed']).toBe(0);
  });

  it('warn() emits entry with status "warning" and message in errors array', () => {
    logger.warn('sess-1', 'agent', 'something went wrong', { detail: 'x' });
    const written = String((writeSpy.mock.calls[0] as [string])[0]);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed['status']).toBe('warning');
    expect((parsed['errors'] as string[])[0]).toBe('something went wrong');
    expect((parsed['output'] as Record<string, unknown>)['detail']).toBe('x');
  });

  it('error() emits entry with status "error"', () => {
    logger.error('sess-1', 'agent', 'boom', ['err1', 'err2']);
    const written = String((writeSpy.mock.calls[0] as [string])[0]);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed['status']).toBe('error');
    expect(parsed['errors']).toEqual(['err1', 'err2']);
  });

  it('error() uses message as sole error when errors array is empty', () => {
    logger.error('s', 'a', 'something failed');
    const written = String((writeSpy.mock.calls[0] as [string])[0]);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(parsed['errors']).toEqual(['something failed']);
  });

  it('log() output is valid JSON', () => {
    logger.info('s', 'a', 't', { input: 'value' }, { output: 'value' }, 0);
    const written = String((writeSpy.mock.calls[0] as [string])[0]).trim();
    expect(() => JSON.parse(written)).not.toThrow();
  });

  it('timestamp is a valid ISO8601 string', () => {
    logger.info('s', 'a', 't', {}, {}, 0);
    const written = String((writeSpy.mock.calls[0] as [string])[0]);
    const parsed = JSON.parse(written) as Record<string, unknown>;
    expect(new Date(parsed['timestamp'] as string).toISOString()).toBe(parsed['timestamp']);
  });
});
