import Ajv from 'ajv';
import type { MCPServerManager } from '@mcp/manager/index.js';

export interface SchemaViolation {
  toolName: string;
  direction: 'input' | 'output';
  violations: string[];
}

export interface ErrorHandlingGap {
  toolName: string;
  reason: string;
}

const ajv = new Ajv({ strict: false, allErrors: true });

export class SchemaValidator {
  constructor(private readonly _manager: MCPServerManager) {}

  async validateOutputSchemas(serverId: string): Promise<SchemaViolation[]> {
    const tools = this._manager.getAvailableTools(serverId);
    const violations: SchemaViolation[] = [];

    for (const tool of tools) {
      if (!tool.outputSchema) continue;

      let result: unknown;
      try {
        const { result: r } = await this._manager.callTool(
          serverId, tool.name, {}, 'schema-validation',
        );
        result = r;
      } catch {
        continue;
      }

      try {
        const validate = ajv.compile(tool.outputSchema);
        const valid = validate(result);
        if (!valid) {
          violations.push({
            toolName: tool.name,
            direction: 'output',
            violations: (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message ?? ''}`),
          });
        }
      } catch (err) {
        violations.push({
          toolName: tool.name,
          direction: 'output',
          violations: [`Schema compilation error: ${String(err)}`],
        });
      }
    }

    return violations;
  }

  async validateErrorHandling(serverId: string): Promise<ErrorHandlingGap[]> {
    const tools = this._manager.getAvailableTools(serverId);
    const gaps: ErrorHandlingGap[] = [];

    for (const tool of tools) {
      try {
        const { result } = await this._manager.callTool(
          serverId, tool.name,
          { __invalid_param_that_should_not_exist__: true },
          'schema-validation',
        );

        const hasErrorField =
          typeof result === 'object' &&
          result !== null &&
          ('error' in result || 'code' in result || 'message' in result);

        if (!hasErrorField) {
          gaps.push({
            toolName: tool.name,
            reason: 'Tool accepted invalid input without returning a structured error response',
          });
        }
      } catch {
        // Exception thrown = some error handling exists; acceptable
      }
    }

    return gaps;
  }
}
