
import type { MCPServerManager } from '../manager/index.js';

export interface SecurityResult {
  sqlInjection: { tested: number; rejected: number; passed: number };
  pathTraversal: { tested: number; rejected: number; passed: number };
  oversizedPayload: { tested: number; rejected: number; passed: number };
}

/** Injection and traversal probe patterns. */
export const SQL_INJECTION_PATTERNS = [
  "'; DROP TABLE",
  "' OR '1'='1",
  "'; SELECT * FROM users; --",
];

export const PATH_TRAVERSAL_PATTERNS = [
  '../',
  '..\\..',
  '../../etc/passwd',
];

/** 1 MB + 1 byte — exceeds the maximum allowed serialized payload size. */
export const OVERSIZED_PAYLOAD_SIZE_BYTES = 1_024 * 1_024 + 1;

export class SecurityTester {
  constructor(private readonly _manager: MCPServerManager) {}

  /**
   * Runs all security probes against the tools registered on `serverId`.
   * TODO (task 22.1): implement probing and response verification.
   */
  async runAll(_serverId: string): Promise<SecurityResult> {
    throw new Error('SecurityTester.runAll() not yet implemented — see task 22.1');
  }
}
