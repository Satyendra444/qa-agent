import type { MCPServerManager } from '@mcp/manager/index.js';
import type { ConcurrencyResult } from './concurrency.js';
import { ConcurrencyTester } from './concurrency.js';
import { buildSampleInput } from './functional.js';
import type { MCPToolSchema } from '@shared/types.js';

export interface PerformanceResult {
  sampleTool?: string;
  sampleCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  throughputPerSecond: number;
  concurrency: ConcurrencyResult;
}

export class PerformanceTester {
  constructor(
    private readonly _manager: MCPServerManager,
    private readonly _concurrencyTester: ConcurrencyTester,
  ) {}

  private chooseProbeTool(tools: MCPToolSchema[]): MCPToolSchema | null {
    return tools.length > 0 ? tools[0] : null;
  }

  private async measureLatency(
    serverId: string,
    toolName: string,
    input: Record<string, unknown>,
    count: number,
  ): Promise<number[]> {
    const latencies: number[] = [];

    for (let i = 0; i < count; i += 1) {
      const start = Date.now();
      try {
        await this._manager.callTool(serverId, toolName, input, 'performance-test');
      } catch {
        // intentionally ignore intermittent failures for latency sampling
      }
      latencies.push(Date.now() - start);
    }

    return latencies;
  }

  async run(serverId: string, concurrencyLevel: number): Promise<PerformanceResult> {
    const tools = this._manager.getAvailableTools(serverId);
    const tool = this.chooseProbeTool(tools);
    const sampleCount = 3;

    if (!tool) {
      return {
        sampleCount,
        averageLatencyMs: 0,
        p95LatencyMs: 0,
        throughputPerSecond: 0,
        concurrency: {
          concurrencyLevel,
          successful: 0,
          timedOut: 0,
          failed: 0,
          durationMs: 0,
        },
      };
    }

    const input = buildSampleInput(tool.inputSchema);
    const latencies = await this.measureLatency(serverId, tool.name, input, sampleCount);
    const sorted = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95) - 1));
    const averageLatencyMs = latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1);
    const p95LatencyMs = sorted.length > 0 ? sorted[p95Index] : 0;
    const concurrency = await this._concurrencyTester.run(serverId, tool.name, input, concurrencyLevel);
    const throughputPerSecond = concurrency.durationMs > 0 ? concurrency.successful / (concurrency.durationMs / 1000) : 0;

    return {
      sampleTool: tool.name,
      sampleCount,
      averageLatencyMs,
      p95LatencyMs,
      throughputPerSecond,
      concurrency,
    };
  }
}
