import type { MCPServerManager } from '@mcp/manager/index.js';
import type { MCPToolSchema } from '@shared/types.js';

export interface FunctionalFailure {
  toolName: string;
  reason: string;
}

export interface FunctionalResult {
  discovered: boolean;
  toolCount: number;
  executed: number;
  successful: number;
  failed: number;
  failures: FunctionalFailure[];
}

const SAMPLE_STRINGS: Record<string, string> = {
  url: 'https://example.com',
  path: '/tmp',
  selector: 'body',
  text: 'sample text',
  query: 'example query',
  command: 'echo test',
  file: '/tmp/test.txt',
  content: 'sample content',
  prompt: 'Please return the word OK',
};

function sampleValueForProperty(
  key: string,
  schema?: Record<string, unknown>,
): unknown {
  const lowerKey = key.toLowerCase();
  for (const fragment of Object.keys(SAMPLE_STRINGS)) {
    if (lowerKey.includes(fragment)) {
      return SAMPLE_STRINGS[fragment];
    }
  }

  if (!schema || typeof schema !== 'object') {
    return 'test';
  }

  if (schema.const !== undefined) {
    return schema.const;
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  switch (schema.type) {
    case 'string':
      return 'test';
    case 'number':
    case 'integer':
      return 1;
    case 'boolean':
      return false;
    case 'object':
      return {};
    case 'array':
      return [];
    default:
      return 'test';
  }
}

export function buildSampleInput(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || schema.type !== 'object') {
    return {};
  }

  const properties = schema.properties as Record<string, unknown> | undefined;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const input: Record<string, unknown> = {};

  if (properties && typeof properties === 'object') {
    for (const [key, value] of Object.entries(properties)) {
      const sampleValue = sampleValueForProperty(key, value as Record<string, unknown>);
      if (sampleValue !== undefined || required.includes(key)) {
        input[key] = sampleValue;
      }
    }
  }

  for (const key of required) {
    if (!(key in input)) {
      input[key] = sampleValueForProperty(key);
    }
  }

  return input;
}

function pickToolsToExecute(tools: MCPToolSchema[]): MCPToolSchema[] {
  return tools.slice(0, 3);
}

export class FunctionalTester {
  constructor(private readonly _manager: MCPServerManager) {}

  validateDiscovery(tools: MCPToolSchema[]): FunctionalResult {
    const failures: FunctionalFailure[] = [];

    for (const tool of tools) {
      if (!tool.name || typeof tool.name !== 'string') {
        failures.push({ toolName: tool.name ?? 'unknown', reason: 'Missing or invalid tool name' });
      }
      if (!tool.description || typeof tool.description !== 'string') {
        failures.push({ toolName: tool.name, reason: 'Missing or invalid tool description' });
      }
      if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
        failures.push({ toolName: tool.name, reason: 'Missing or invalid tool input schema' });
      }
    }

    return {
      discovered: tools.length > 0,
      toolCount: tools.length,
      executed: 0,
      successful: Math.max(0, tools.length - failures.length),
      failed: failures.length,
      failures,
    };
  }

  async runExecution(serverId: string): Promise<FunctionalResult> {
    const tools = this._manager.getAvailableTools(serverId);
    const failures: FunctionalFailure[] = [];
    let successful = 0;
    let failed = 0;
    let executed = 0;

    const selectedTools = pickToolsToExecute(tools);

    for (const tool of selectedTools) {
      executed += 1;
      const input = buildSampleInput(tool.inputSchema);

      try {
        await this._manager.callTool(serverId, tool.name, input, 'functional-test');
        successful += 1;
      } catch (err) {
        failed += 1;
        failures.push({ toolName: tool.name, reason: String(err) });
      }
    }

    return {
      discovered: tools.length > 0,
      toolCount: tools.length,
      executed,
      successful,
      failed,
      failures,
    };
  }
}
