import type { ILogger } from '@logging/logger.js';
import type { MCPServerManager } from '@mcp/manager/index.js';
import { ContractValidator } from './contract.js';
import type { ContractValidationResult } from './contract.js';
import { SchemaValidator } from './schema.js';
import type { SchemaViolation, ErrorHandlingGap } from './schema.js';
import { SecurityTester } from './security.js';
import type { SecurityResult } from './security.js';
import { ConcurrencyTester, MIN_CONCURRENCY, MAX_CONCURRENCY } from './concurrency.js';
import type { ConcurrencyResult } from './concurrency.js';
import { FunctionalTester, FunctionalResult } from './functional.js';
import { NegativeTester, NegativeResult } from './negative.js';
import { PerformanceTester, PerformanceResult } from './performance.js';

export interface MCPTestingConfig {
  concurrencyLevel: number;
  timeoutMs: number;
}

export interface MCPTestReport {
  serverId: string;
  generatedAt: string;
  toolCount: number;
  contractTests: ContractValidationResult;
  schemaViolations: SchemaViolation[];
  errorHandlingGaps: ErrorHandlingGap[];
  functional: FunctionalResult;
  negativeTests: NegativeResult;
  performance: PerformanceResult;
  concurrencyResults: ConcurrencyResult;
  securityResults: SecurityResult;
}

export class MCPTestingFramework {
  private readonly _contract: ContractValidator;
  private readonly _schema: SchemaValidator;
  private readonly _security: SecurityTester;
  private readonly _concurrency: ConcurrencyTester;
  private readonly _functional: FunctionalTester;
  private readonly _negative: NegativeTester;
  private readonly _performance: PerformanceTester;

  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _config: MCPTestingConfig,
    private readonly _logger: ILogger,
  ) {
    if (
      _config.concurrencyLevel < MIN_CONCURRENCY ||
      _config.concurrencyLevel > MAX_CONCURRENCY
    ) {
      throw new Error(
        `MCPTestingFramework: concurrencyLevel must be ${MIN_CONCURRENCY}–${MAX_CONCURRENCY}, got ${_config.concurrencyLevel}`,
      );
    }

    this._contract = new ContractValidator();
    this._schema = new SchemaValidator(_manager);
    this._security = new SecurityTester(_manager);
    this._concurrency = new ConcurrencyTester(_manager, _config.timeoutMs);
    this._functional = new FunctionalTester(_manager);
    this._negative = new NegativeTester(_manager);
    this._performance = new PerformanceTester(_manager, this._concurrency);
  }

  async runAllTests(serverId: string): Promise<MCPTestReport> {
    const tools = this._manager.getAvailableTools(serverId);
    this._logger.info('system', 'mcp.testing', 'test.start', { serverId }, { toolCount: tools.length }, 0);

    const contractTests = this._contract.validate(tools);

    const [schemaViolations, errorHandlingGaps, securityResults] = await Promise.all([
      this._schema.validateOutputSchemas(serverId),
      this._schema.validateErrorHandling(serverId),
      this._security.runAll(serverId),
    ]);

    const [functionalDiscovery, negativeTests, performance] = await Promise.all([
      Promise.resolve(this._functional.validateDiscovery(tools)),
      this._negative.run(serverId),
      this._performance.run(serverId, this._config.concurrencyLevel),
    ]);

    // Concurrency test against first available tool (if any)
    let concurrencyResults: ConcurrencyResult = {
      concurrencyLevel: this._config.concurrencyLevel,
      successful: 0,
      timedOut: 0,
      failed: 0,
      durationMs: 0,
    };

    if (tools.length > 0) {
      const firstTool = tools[0];
      if (firstTool !== undefined) {
        try {
          concurrencyResults = await this._concurrency.run(
            serverId, firstTool.name, {}, this._config.concurrencyLevel,
          );
        } catch (err) {
          this._logger.warn('system', 'mcp.testing', `Concurrency test failed: ${String(err)}`);
        }
      }
    }

    const report: MCPTestReport = {
      serverId,
      generatedAt: new Date().toISOString(),
      toolCount: tools.length,
      contractTests,
      schemaViolations,
      errorHandlingGaps,
      functional: functionalDiscovery,
      negativeTests,
      performance,
      concurrencyResults,
      securityResults,
    };

    this._logger.info(
      'system', 'mcp.testing', 'test.complete',
      { serverId },
      {
        toolCount: tools.length,
        contractPassed: contractTests.passed,
        contractFailed: contractTests.failed,
        schemaViolations: schemaViolations.length,
        errorHandlingGaps: errorHandlingGaps.length,
      },
      0,
    );

    return report;
  }

  async runContractTests(serverId: string): Promise<MCPTestReport> {
    return this.runAllTests(serverId);
  }

    this._logger.info(
      'system', 'mcp.testing', 'test.complete',
      { serverId },
      {
        toolCount: tools.length,
        contractPassed: contractTests.passed,
        contractFailed: contractTests.failed,
        schemaViolations: schemaViolations.length,
        errorHandlingGaps: errorHandlingGaps.length,
      },
      0,
    );

    return report;
  }
}
