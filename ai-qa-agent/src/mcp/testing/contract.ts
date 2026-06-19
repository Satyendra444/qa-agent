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

export class ContractValidator {
  /**
   * Validates the input schema of each supplied tool.
   * Returns counts plus per-failure detail.
   * TODO (task 20.1): use AJV strict mode to validate JSON Schema structure.
   */
  validate(_tools: MCPToolSchema[]): ContractValidationResult {
    throw new Error('ContractValidator.validate() not yet implemented — see task 20.1');
  }
}
