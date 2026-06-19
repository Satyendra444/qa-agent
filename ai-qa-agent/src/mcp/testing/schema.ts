import type { MCPServerManager } from '../manager/index.js';

export interface SchemaViolation {
  toolName: string;
  direction: 'input' | 'output';
  violations: string[];
}

export interface ErrorHandlingGap {
  toolName: string;
  reason: string;
}

export class SchemaValidator {
  constructor(private readonly _manager: MCPServerManager) {}

  /**
   * For each tool on `serverId`, invoke with valid input and check output schema.
   * TODO (task 21.1): implement using AJV.
   */
  async validateOutputSchemas(_serverId: string): Promise<SchemaViolation[]> {
    throw new Error('SchemaValidator.validateOutputSchemas() not yet implemented — see task 21.1');
  }

  /**
   * For each tool on `serverId`, invoke with invalid input and verify structured
   * error responses.
   * TODO (task 21.1): implement structured-error verification.
   */
  async validateErrorHandling(_serverId: string): Promise<ErrorHandlingGap[]> {
    throw new Error('SchemaValidator.validateErrorHandling() not yet implemented — see task 21.1');
  }
}
