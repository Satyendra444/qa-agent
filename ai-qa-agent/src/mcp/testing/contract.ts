import Ajv from 'ajv';
import type { MCPToolSchema } from '@shared/types.js';

export interface ContractFailure {
  toolName: string;
  reason: string;
}

export interface ContractValidationResult {
  passed: number;
  failed: number;
  failures: ContractFailure[];
}

const ajv = new Ajv({ strict: true, allErrors: true });

export class ContractValidator {
  validate(tools: MCPToolSchema[]): ContractValidationResult {
    const failures: ContractFailure[] = [];

    for (const tool of tools) {
      try {
        const valid = ajv.validateSchema(tool.inputSchema);
        if (!valid) {
          const errors = (ajv.errors ?? []).map((e: { message?: string }) => e.message ?? 'unknown error').join('; ');
          failures.push({ toolName: tool.name, reason: `Invalid JSON Schema: ${errors}` });
        }
      } catch (err) {
        failures.push({ toolName: tool.name, reason: `Schema validation threw: ${String(err)}` });
      }
    }

    return {
      passed: tools.length - failures.length,
      failed: failures.length,
      failures,
    };
  }
}
