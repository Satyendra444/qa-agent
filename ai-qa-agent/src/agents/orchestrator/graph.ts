

import type { PipelineState } from '@shared/types.js';
export type PipelineNode = (state: PipelineState) => Promise<Partial<PipelineState>>;

export interface PipelineGraph {
  /** Runs the compiled state graph from the initial state. */
  invoke(state: PipelineState): Promise<PipelineState>;
}

export function buildPipelineGraph(
  _nodes: Record<string, PipelineNode>,
): PipelineGraph {
  throw new Error('buildPipelineGraph() not yet implemented — see task 18.1');
}
