import type { MCPServerManager } from '@mcp/manager/index.js';
import type { MCPToolSchema } from '@shared/types.js';
import { buildSampleInput } from './functional.js';

export interface NegativeCheck {
  toolName: string;
  category: 'invalidParams' | 'missingParams' | 'unauthorized';
  passed: boolean;
  reason?: string;
}

export interface NegativeResult {
  invalidParams: NegativeCheck[];
  missingParams: NegativeCheck[];
  unauthorizedRequests: NegativeCheck[];
}

function buildInvalidInput(tool: MCPToolSchema): Record<string, unknown> {
  const validInput = buildSampleInput(tool.inputSchema);
  return {
    ...validInput,
    __invalid_parameter__: 'invalid',
  };
}

function buildMissingInput(tool: MCPToolSchema): Record<string, unknown> {
  const validInput = buildSampleInput(tool.inputSchema);
  const schema = tool.inputSchema as Record<string, unknown>;

  if (!schema || typeof schema !== 'object') {
    return {};
  }

  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  if (required.length === 0) {
    const copy = { ...validInput };
    delete copy[Object.keys(copy)[0] ?? ''];
    return copy;
  }

  const missing = { ...validInput };
  delete missing[required[0]];
  return missing;
}

function isStructuredError(result: unknown): boolean {
  if (result === null || result === undefined) {
    return true;
  }

  if (typeof result === 'object') {
    const output = result as Record<string, unknown>;
    if ('error' in output || 'code' in output || 'message' in output) {
      return true;
    }
  }

  return false;
}

export class NegativeTester {
  constructor(private readonly _manager: MCPServerManager) {}

  async run(serverId: string): Promise<NegativeResult> {
    const tools = this._manager.getAvailableTools(serverId);
    const invalidParams: NegativeCheck[] = [];
    const missingParams: NegativeCheck[] = [];
    const unauthorizedRequests: NegativeCheck[] = [];

    for (const tool of tools) {
      const invalidInput = buildInvalidInput(tool);
      try {
        const { result } = await this._manager.callTool(serverId, tool.name, invalidInput, 'negative-test');
        if (isStructuredError(result)) {
          invalidParams.push({ toolName: tool.name, category: 'invalidParams', passed: true });
        } else {
          invalidParams.push({
            toolName: tool.name,
            category: 'invalidParams',
            passed: false,
            reason: 'Tool accepted invalid parameters without a structured error response',
          });
        }
      } catch {
        invalidParams.push({ toolName: tool.name, category: 'invalidParams', passed: true });
      }

      const missingInput = buildMissingInput(tool);
      try {
        const { result } = await this._manager.callTool(serverId, tool.name, missingInput, 'negative-test');
        if (isStructuredError(result)) {
          missingParams.push({ toolName: tool.name, category: 'missingParams', passed: true });
        } else {
          missingParams.push({
            toolName: tool.name,
            category: 'missingParams',
            passed: false,
            reason: 'Tool accepted missing required parameters without a structured error response',
          });
        }
      } catch {
        missingParams.push({ toolName: tool.name, category: 'missingParams', passed: true });
      }

      try {
        await this._manager.callTool(serverId, tool.name, buildSampleInput(tool.inputSchema), '');
        unauthorizedRequests.push({
          toolName: tool.name,
          category: 'unauthorized',
          passed: false,
          reason: 'Call succeeded despite missing session identifier',
        });
      } catch {
        unauthorizedRequests.push({ toolName: tool.name, category: 'unauthorized', passed: true });
      }
    }

    return {
      invalidParams,
      missingParams,
      unauthorizedRequests,
    };
  }
}
