
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, type Config } from './config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save originals so we can restore after each test. */
const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

/** Minimal valid env — satisfies both required vars. */
function validBase(): Record<string, string> {
  return {
    OPENAI_API_KEY: 'sk-test-key',
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/qa_agent',
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Wipe process.env so each test starts from a clean slate.
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
});

afterEach(() => {
  // Restore original environment.
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

// ---------------------------------------------------------------------------
// Required variable tests
// ---------------------------------------------------------------------------

describe('loadConfig — required variables', () => {
  it('throws when OPENAI_API_KEY is missing', () => {
    setEnv({ DATABASE_URL: 'postgresql://localhost/test' });
    expect(() => loadConfig()).toThrow(/OPENAI_API_KEY/);
  });

  it('throws when OPENAI_API_KEY is empty string', () => {
    setEnv({ OPENAI_API_KEY: '', DATABASE_URL: 'postgresql://localhost/test' });
    expect(() => loadConfig()).toThrow(/OPENAI_API_KEY/);
  });

  it('throws when OPENAI_API_KEY is whitespace-only', () => {
    setEnv({ OPENAI_API_KEY: '   ', DATABASE_URL: 'postgresql://localhost/test' });
    expect(() => loadConfig()).toThrow(/OPENAI_API_KEY/);
  });

  it('throws when DATABASE_URL is missing', () => {
    setEnv({ OPENAI_API_KEY: 'sk-test' });
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it('throws when DATABASE_URL is empty string', () => {
    setEnv({ OPENAI_API_KEY: 'sk-test', DATABASE_URL: '' });
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it('succeeds when both required vars are set', () => {
    setEnv(validBase());
    expect(() => loadConfig()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Optional defaults
// ---------------------------------------------------------------------------

describe('loadConfig — optional defaults', () => {
  beforeEach(() => setEnv(validBase()));

  it('uses default OPENAI_BASE_URL', () => {
    expect(loadConfig().openaiBaseUrl).toBe('https://api.openai.com/v1');
  });

  it('uses default LLM_MODEL', () => {
    expect(loadConfig().llmModel).toBe('gpt-4o');
  });

  it('uses default COST_PER_TOKEN', () => {
    expect(loadConfig().costPerToken).toBeCloseTo(0.000001);
  });

  it('uses default PLAYWRIGHT_MCP_COMMAND', () => {
    expect(loadConfig().playwrightMcpCommand).toBe('npx');
  });

  it('uses default PLAYWRIGHT_MCP_ARGS', () => {
    expect(loadConfig().playwrightMcpArgs).toBe('@playwright/mcp');
  });

  it('uses default FILESYSTEM_MCP_COMMAND', () => {
    expect(loadConfig().filesystemMcpCommand).toBe('npx');
  });

  it('uses default FILESYSTEM_MCP_ARGS', () => {
    expect(loadConfig().filesystemMcpArgs).toBe(
      '@modelcontextprotocol/server-filesystem,/workspace',
    );
  });

  it('uses default PORT = 3000', () => {
    expect(loadConfig().port).toBe(3000);
  });

  it('uses default MCP_TOOL_TIMEOUT_MS = 30000', () => {
    expect(loadConfig().mcpToolTimeoutMs).toBe(30000);
  });

  it('uses default MCP_CONNECT_TIMEOUT_MS = 10000', () => {
    expect(loadConfig().mcpConnectTimeoutMs).toBe(10000);
  });

  it('uses default HALLUCINATION_THRESHOLD = 0.7', () => {
    expect(loadConfig().hallucinationThreshold).toBeCloseTo(0.7);
  });

  it('uses default REPORT_DIR = ./reports', () => {
    expect(loadConfig().reportDir).toBe('./reports');
  });

  it('returns undefined for POSTGRES_MCP_URL when unset', () => {
    expect(loadConfig().postgresMcpUrl).toBeUndefined();
  });

  it('returns undefined for GITHUB_MCP_URL when unset', () => {
    expect(loadConfig().githubMcpUrl).toBeUndefined();
  });

  it('returns undefined for LOG_RETENTION_DAYS when unset', () => {
    expect(loadConfig().logRetentionDays).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Optional override values
// ---------------------------------------------------------------------------

describe('loadConfig — optional overrides', () => {
  beforeEach(() => setEnv(validBase()));

  it('respects OPENAI_BASE_URL override', () => {
    setEnv({ OPENAI_BASE_URL: 'https://custom.openai.example.com/v1' });
    expect(loadConfig().openaiBaseUrl).toBe('https://custom.openai.example.com/v1');
  });

  it('respects LLM_MODEL override', () => {
    setEnv({ LLM_MODEL: 'gpt-3.5-turbo' });
    expect(loadConfig().llmModel).toBe('gpt-3.5-turbo');
  });

  it('respects POSTGRES_MCP_URL when set', () => {
    setEnv({ POSTGRES_MCP_URL: 'http://localhost:5173' });
    expect(loadConfig().postgresMcpUrl).toBe('http://localhost:5173');
  });

  it('respects GITHUB_MCP_URL when set', () => {
    setEnv({ GITHUB_MCP_URL: 'http://localhost:5174' });
    expect(loadConfig().githubMcpUrl).toBe('http://localhost:5174');
  });

  it('respects PORT override', () => {
    setEnv({ PORT: '8080' });
    expect(loadConfig().port).toBe(8080);
  });

  it('respects REPORT_DIR override', () => {
    setEnv({ REPORT_DIR: '/var/reports' });
    expect(loadConfig().reportDir).toBe('/var/reports');
  });

  it('respects LOG_RETENTION_DAYS override', () => {
    setEnv({ LOG_RETENTION_DAYS: '90' });
    expect(loadConfig().logRetentionDays).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Range / type validation — MCP_TOOL_TIMEOUT_MS (1–300000)
// ---------------------------------------------------------------------------

describe('loadConfig — MCP_TOOL_TIMEOUT_MS validation', () => {
  beforeEach(() => setEnv(validBase()));

  it('accepts minimum value 1', () => {
    setEnv({ MCP_TOOL_TIMEOUT_MS: '1' });
    expect(loadConfig().mcpToolTimeoutMs).toBe(1);
  });

  it('accepts maximum value 300000', () => {
    setEnv({ MCP_TOOL_TIMEOUT_MS: '300000' });
    expect(loadConfig().mcpToolTimeoutMs).toBe(300000);
  });

  it('throws when value is 0 (below range)', () => {
    setEnv({ MCP_TOOL_TIMEOUT_MS: '0' });
    expect(() => loadConfig()).toThrow(/MCP_TOOL_TIMEOUT_MS/);
  });

  it('throws when value is 300001 (above range)', () => {
    setEnv({ MCP_TOOL_TIMEOUT_MS: '300001' });
    expect(() => loadConfig()).toThrow(/MCP_TOOL_TIMEOUT_MS/);
  });

  it('throws when value is a float', () => {
    setEnv({ MCP_TOOL_TIMEOUT_MS: '500.5' });
    expect(() => loadConfig()).toThrow(/MCP_TOOL_TIMEOUT_MS/);
  });

  it('throws when value is not a number', () => {
    setEnv({ MCP_TOOL_TIMEOUT_MS: 'abc' });
    expect(() => loadConfig()).toThrow(/MCP_TOOL_TIMEOUT_MS/);
  });
});

// ---------------------------------------------------------------------------
// Range / type validation — HALLUCINATION_THRESHOLD (0.0–1.0)
// ---------------------------------------------------------------------------

describe('loadConfig — HALLUCINATION_THRESHOLD validation', () => {
  beforeEach(() => setEnv(validBase()));

  it('accepts 0.0', () => {
    setEnv({ HALLUCINATION_THRESHOLD: '0.0' });
    expect(loadConfig().hallucinationThreshold).toBeCloseTo(0.0);
  });

  it('accepts 1.0', () => {
    setEnv({ HALLUCINATION_THRESHOLD: '1.0' });
    expect(loadConfig().hallucinationThreshold).toBeCloseTo(1.0);
  });

  it('accepts 0.5', () => {
    setEnv({ HALLUCINATION_THRESHOLD: '0.5' });
    expect(loadConfig().hallucinationThreshold).toBeCloseTo(0.5);
  });

  it('throws when value is -0.1 (below range)', () => {
    setEnv({ HALLUCINATION_THRESHOLD: '-0.1' });
    expect(() => loadConfig()).toThrow(/HALLUCINATION_THRESHOLD/);
  });

  it('throws when value is 1.1 (above range)', () => {
    setEnv({ HALLUCINATION_THRESHOLD: '1.1' });
    expect(() => loadConfig()).toThrow(/HALLUCINATION_THRESHOLD/);
  });

  it('throws when value is not a number', () => {
    setEnv({ HALLUCINATION_THRESHOLD: 'high' });
    expect(() => loadConfig()).toThrow(/HALLUCINATION_THRESHOLD/);
  });
});

// ---------------------------------------------------------------------------
// Range / type validation — LOG_RETENTION_DAYS (1–36500 or undefined)
// ---------------------------------------------------------------------------

describe('loadConfig — LOG_RETENTION_DAYS validation', () => {
  beforeEach(() => setEnv(validBase()));

  it('accepts minimum value 1', () => {
    setEnv({ LOG_RETENTION_DAYS: '1' });
    expect(loadConfig().logRetentionDays).toBe(1);
  });

  it('accepts maximum value 36500', () => {
    setEnv({ LOG_RETENTION_DAYS: '36500' });
    expect(loadConfig().logRetentionDays).toBe(36500);
  });

  it('throws when value is 0 (below range)', () => {
    setEnv({ LOG_RETENTION_DAYS: '0' });
    expect(() => loadConfig()).toThrow(/LOG_RETENTION_DAYS/);
  });

  it('throws when value is 36501 (above range)', () => {
    setEnv({ LOG_RETENTION_DAYS: '36501' });
    expect(() => loadConfig()).toThrow(/LOG_RETENTION_DAYS/);
  });

  it('throws when value is a float', () => {
    setEnv({ LOG_RETENTION_DAYS: '30.5' });
    expect(() => loadConfig()).toThrow(/LOG_RETENTION_DAYS/);
  });

  it('returns undefined for empty string (retain indefinitely)', () => {
    setEnv({ LOG_RETENTION_DAYS: '' });
    expect(loadConfig().logRetentionDays).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PORT range validation (1–65535)
// ---------------------------------------------------------------------------

describe('loadConfig — PORT validation', () => {
  beforeEach(() => setEnv(validBase()));

  it('accepts port 1', () => {
    setEnv({ PORT: '1' });
    expect(loadConfig().port).toBe(1);
  });

  it('accepts port 65535', () => {
    setEnv({ PORT: '65535' });
    expect(loadConfig().port).toBe(65535);
  });

  it('throws when port is 0', () => {
    setEnv({ PORT: '0' });
    expect(() => loadConfig()).toThrow(/PORT/);
  });

  it('throws when port is 65536', () => {
    setEnv({ PORT: '65536' });
    expect(() => loadConfig()).toThrow(/PORT/);
  });
});

// ---------------------------------------------------------------------------
// COST_PER_TOKEN validation
// ---------------------------------------------------------------------------

describe('loadConfig — COST_PER_TOKEN validation', () => {
  beforeEach(() => setEnv(validBase()));

  it('accepts a valid positive float', () => {
    setEnv({ COST_PER_TOKEN: '0.002' });
    expect(loadConfig().costPerToken).toBeCloseTo(0.002);
  });

  it('accepts 0', () => {
    setEnv({ COST_PER_TOKEN: '0' });
    expect(loadConfig().costPerToken).toBe(0);
  });

  it('throws when value is negative', () => {
    setEnv({ COST_PER_TOKEN: '-0.001' });
    expect(() => loadConfig()).toThrow(/COST_PER_TOKEN/);
  });

  it('throws when value is not a number', () => {
    setEnv({ COST_PER_TOKEN: 'free' });
    expect(() => loadConfig()).toThrow(/COST_PER_TOKEN/);
  });
});

// ---------------------------------------------------------------------------
// Full happy-path: all values explicitly set
// ---------------------------------------------------------------------------

describe('loadConfig — full happy path', () => {
  it('returns a correctly shaped Config object when all vars are set', () => {
    setEnv({
      OPENAI_API_KEY: 'sk-live-key',
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      LLM_MODEL: 'gpt-4o',
      COST_PER_TOKEN: '0.000002',
      DATABASE_URL: 'postgresql://postgres:pw@localhost:5432/qa',
      PLAYWRIGHT_MCP_COMMAND: 'npx',
      PLAYWRIGHT_MCP_ARGS: '@playwright/mcp',
      FILESYSTEM_MCP_COMMAND: 'npx',
      FILESYSTEM_MCP_ARGS: '@modelcontextprotocol/server-filesystem,/workspace',
      POSTGRES_MCP_URL: 'http://localhost:5173',
      GITHUB_MCP_URL: 'http://localhost:5174',
      PORT: '3000',
      MCP_TOOL_TIMEOUT_MS: '30000',
      MCP_CONNECT_TIMEOUT_MS: '10000',
      HALLUCINATION_THRESHOLD: '0.7',
      LOG_RETENTION_DAYS: '365',
      REPORT_DIR: './reports',
    });

    const config: Config = loadConfig();

    expect(config.openaiApiKey).toBe('sk-live-key');
    expect(config.openaiBaseUrl).toBe('https://api.openai.com/v1');
    expect(config.llmModel).toBe('gpt-4o');
    expect(config.costPerToken).toBeCloseTo(0.000002);
    expect(config.databaseUrl).toBe('postgresql://postgres:pw@localhost:5432/qa');
    expect(config.playwrightMcpCommand).toBe('npx');
    expect(config.playwrightMcpArgs).toBe('@playwright/mcp');
    expect(config.filesystemMcpCommand).toBe('npx');
    expect(config.filesystemMcpArgs).toBe(
      '@modelcontextprotocol/server-filesystem,/workspace',
    );
    expect(config.postgresMcpUrl).toBe('http://localhost:5173');
    expect(config.githubMcpUrl).toBe('http://localhost:5174');
    expect(config.port).toBe(3000);
    expect(config.mcpToolTimeoutMs).toBe(30000);
    expect(config.mcpConnectTimeoutMs).toBe(10000);
    expect(config.hallucinationThreshold).toBeCloseTo(0.7);
    expect(config.logRetentionDays).toBe(365);
    expect(config.reportDir).toBe('./reports');
  });
});

// ---------------------------------------------------------------------------
// Whitespace trimming
// ---------------------------------------------------------------------------

describe('loadConfig — whitespace trimming', () => {
  it('trims leading/trailing whitespace from OPENAI_API_KEY', () => {
    setEnv({ OPENAI_API_KEY: '  sk-trimmed  ', DATABASE_URL: 'postgresql://localhost/test' });
    expect(loadConfig().openaiApiKey).toBe('sk-trimmed');
  });

  it('trims leading/trailing whitespace from LLM_MODEL', () => {
    setEnv({ ...validBase(), LLM_MODEL: '  gpt-4  ' });
    expect(loadConfig().llmModel).toBe('gpt-4');
  });
});
