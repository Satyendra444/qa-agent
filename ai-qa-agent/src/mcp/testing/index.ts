
import type { ILogger } from '@logging/logger.js';
import type { MCPServerManager } from '../manager/index.js';
import type { ContractValidationResult } from './contract.js';
import type { SchemaViolation, ErrorHandlingGap } from './schema.js';
import type { ConcurrencyResult } from './concurrency.js';
import type { SecurityResult } from './security.js';

export interface MCPTestingConfig {
  /** Must be in range 1–50; validated before any calls are made. */
  concurrencyLevel: number;
  /** Default: 30 000 ms. */
  timeoutMs: number;
}

export interface MCPTestReport {
  serverId: string;
  toolCount: number;
  contractTests: ContractValidationResult;
  schemaViolations: SchemaViolation[];
  errorHandlingGaps: ErrorHandlingGap[];
  concurrencyResults: ConcurrencyResult;
  securityResults: SecurityResult;
}

export class MCPTestingFramework {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _config: MCPTestingConfig,
    private readonly _logger: ILogger,
  ) {}

  /**
   * Runs the full test suite against the given server and returns a structured report.
   * TODO (task 23.2): orchestrate ContractValidator, SchemaValidator, SecurityTester,
   *                   ConcurrencyTester and assemble MCPTestReport.
   */
  async runContractTests(_serverId: string): Promise<MCPTestReport> {
    throw new Error('MCPTestingFramework.runContractTests() not yet implemented — see task 23.2');
  }
}
