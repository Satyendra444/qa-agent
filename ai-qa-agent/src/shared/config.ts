
export interface Config {
  // LLM
  openaiApiKey: string;
  openaiBaseUrl: string;
  llmModel: string;
  costPerToken: number;

  // Database
  databaseUrl: string;

  // MCP Servers
  playwrightMcpCommand: string;
  playwrightMcpArgs: string;
  filesystemMcpCommand: string;
  filesystemMcpArgs: string;
  postgresMcpUrl: string | undefined;
  githubMcpUrl: string | undefined;

  // Application
  port: number;
  mcpToolTimeoutMs: number;
  mcpConnectTimeoutMs: number;
  hallucinationThreshold: number;
  logRetentionDays: number | undefined;
  reportDir: string;
}

/**
 * Retrieves a required environment variable.
 * Throws a descriptive error if the variable is absent or empty.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `[config] Missing required environment variable: ${name}. ` +
        `Please set it in your .env file or environment before starting the application.`,
    );
  }
  return value.trim();
}

/**
 * Retrieves an optional environment variable, returning the provided default
 * when the variable is absent or empty.
 */
function optionalEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  return value.trim();
}

/**
 * Parses an environment variable as a float within an inclusive range.
 * Falls back to `defaultValue` when the variable is absent or empty.
 * Throws a descriptive error if the value cannot be parsed or is out of range.
 */
function parseFloat_(
  name: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return defaultValue;
  }
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `[config] ${name} must be a finite number (got: "${raw}"). ` +
        `Please provide a valid numeric value.`,
    );
  }
  if (parsed < min || parsed > max) {
    throw new Error(
      `[config] ${name} must be between ${min} and ${max} (got: ${parsed}). ` +
        `Please set a value within the valid range.`,
    );
  }
  return parsed;
}

/**
 * Parses an environment variable as an integer within an inclusive range.
 * Falls back to `defaultValue` when the variable is absent or empty.
 * Throws a descriptive error if the value cannot be parsed or is out of range.
 */
function parseInt_(
  name: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return defaultValue;
  }
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed)) {
    throw new Error(
      `[config] ${name} must be a whole number (got: "${raw}"). ` +
        `Please provide a valid integer value.`,
    );
  }
  if (parsed < min || parsed > max) {
    throw new Error(
      `[config] ${name} must be between ${min} and ${max} (got: ${parsed}). ` +
        `Please set a value within the valid range.`,
    );
  }
  return parsed;
}

/**
 * Parses an environment variable as a positive integer.
 * Returns `undefined` when the variable is absent or empty (meaning "no limit").
 * Throws a descriptive error if a non-empty value cannot be parsed as a valid integer.
 */
function parseOptionalPositiveInt(
  name: string,
  min: number,
  max: number,
): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed)) {
    throw new Error(
      `[config] ${name} must be a whole number when provided (got: "${raw}"). ` +
        `Please provide a valid integer value or leave it blank.`,
    );
  }
  if (parsed < min || parsed > max) {
    throw new Error(
      `[config] ${name} must be between ${min} and ${max} when provided (got: ${parsed}). ` +
        `Please set a value within the valid range or leave it blank.`,
    );
  }
  return parsed;
}

/**
 * Parses an environment variable as a positive float (no upper bound enforced beyond
 * being finite and positive).  Falls back to `defaultValue` when absent or empty.
 */
function parsePositiveFloat(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return defaultValue;
  }
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `[config] ${name} must be a non-negative finite number (got: "${raw}"). ` +
        `Please provide a valid numeric value.`,
    );
  }
  return parsed;
}

/**
 * Loads and validates all environment variables required by the application.
 *
 * Call this once at application startup (e.g. in `src/index.ts` before wiring
 * any components).  The returned `Config` object is plain data — safe to pass
 * via dependency injection to any module that needs configuration.
 *
 * @throws {Error} If any required variable is missing or any variable fails
 *                 validation (type mismatch, out-of-range, etc.).
 */
export function loadConfig(): Config {
  // ── Required ──────────────────────────────────────────────────────────────
  const openaiApiKey = requireEnv('OPENAI_API_KEY');
  const databaseUrl = requireEnv('DATABASE_URL');

  // ── Optional with defaults ─────────────────────────────────────────────────
  const openaiBaseUrl = optionalEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  const llmModel = optionalEnv('LLM_MODEL', 'gpt-4o');
  const costPerToken = parsePositiveFloat('COST_PER_TOKEN', 0.000001);

  const playwrightMcpCommand = optionalEnv('PLAYWRIGHT_MCP_COMMAND', 'npx');
  const playwrightMcpArgs = optionalEnv('PLAYWRIGHT_MCP_ARGS', '@playwright/mcp');
  const filesystemMcpCommand = optionalEnv('FILESYSTEM_MCP_COMMAND', 'npx');
  const filesystemMcpArgs = optionalEnv(
    'FILESYSTEM_MCP_ARGS',
    '@modelcontextprotocol/server-filesystem,/workspace',
  );

  // ── Optional with no default (undefined when absent) ──────────────────────
  const rawPostgresMcpUrl = process.env['POSTGRES_MCP_URL'];
  const postgresMcpUrl =
    rawPostgresMcpUrl && rawPostgresMcpUrl.trim() !== ''
      ? rawPostgresMcpUrl.trim()
      : undefined;

  const rawGithubMcpUrl = process.env['GITHUB_MCP_URL'];
  const githubMcpUrl =
    rawGithubMcpUrl && rawGithubMcpUrl.trim() !== ''
      ? rawGithubMcpUrl.trim()
      : undefined;

  // ── Numeric with range validation ─────────────────────────────────────────
  const port = parseInt_('PORT', 3000, 1, 65535);
  const mcpToolTimeoutMs = parseInt_('MCP_TOOL_TIMEOUT_MS', 30000, 1, 300000);
  const mcpConnectTimeoutMs = parseInt_('MCP_CONNECT_TIMEOUT_MS', 10000, 1, 300000);
  const hallucinationThreshold = parseFloat_(
    'HALLUCINATION_THRESHOLD',
    0.7,
    0.0,
    1.0,
  );

  // ── Optional integer (undefined = retain indefinitely) ────────────────────
  const logRetentionDays = parseOptionalPositiveInt('LOG_RETENTION_DAYS', 1, 36500);

  const reportDir = optionalEnv('REPORT_DIR', './reports');

  return {
    openaiApiKey,
    openaiBaseUrl,
    llmModel,
    costPerToken,
    databaseUrl,
    playwrightMcpCommand,
    playwrightMcpArgs,
    filesystemMcpCommand,
    filesystemMcpArgs,
    postgresMcpUrl,
    githubMcpUrl,
    port,
    mcpToolTimeoutMs,
    mcpConnectTimeoutMs,
    hallucinationThreshold,
    logRetentionDays,
    reportDir,
  };
}
