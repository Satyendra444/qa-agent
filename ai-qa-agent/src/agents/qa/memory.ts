import type { MemoryEntry, QAReport, PlannedAction } from './types.js';

export interface IAgentMemory {
  store(entry: MemoryEntry): void;
  getByTask(task: string): MemoryEntry[];
  getLast(n: number): MemoryEntry[];
  findSimilarTask(task: string): MemoryEntry | undefined;
  clear(): void;
  size: number;
}

export class InMemoryAgentMemory implements IAgentMemory {
  private readonly _entries: MemoryEntry[] = [];
  private readonly _maxSize: number;

  constructor(maxSize = 100) {
    this._maxSize = maxSize;
  }

  store(entry: MemoryEntry): void {
    this._entries.push(entry);
    if (this._entries.length > this._maxSize) {
      this._entries.splice(0, this._entries.length - this._maxSize);
    }
  }

  getByTask(task: string): MemoryEntry[] {
    const needle = task.toLowerCase();
    return this._entries.filter((e) => e.task.toLowerCase().includes(needle));
  }

  getLast(n: number): MemoryEntry[] {
    return this._entries.slice(-n);
  }

  findSimilarTask(task: string): MemoryEntry | undefined {
    const words = new Set(task.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    let bestScore = 0;
    let best: MemoryEntry | undefined;

    for (const entry of this._entries) {
      const entryWords = entry.task.toLowerCase().split(/\s+/);
      const matches = entryWords.filter((w) => words.has(w)).length;
      const score = words.size > 0 ? matches / words.size : 0;
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    return bestScore >= 0.5 ? best : undefined;
  }

  clear(): void {
    this._entries.splice(0);
  }

  get size(): number {
    return this._entries.length;
  }

  static makeEntry(
    sessionId: string,
    task: string,
    actions: PlannedAction[],
    report: QAReport,
  ): MemoryEntry {
    return { sessionId, task, actions, report, timestamp: new Date().toISOString() };
  }
}
