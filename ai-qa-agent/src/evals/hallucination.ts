import type { HallucinationFlag } from '@shared/types.js';

export class HallucinationDetector {

  detect(_agentOutput: string, _requirement: string): HallucinationFlag[] {
    throw new Error('HallucinationDetector.detect() not yet implemented — see task 26.1');
  }
}
