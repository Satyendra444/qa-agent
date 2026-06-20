import type { ActionResult, ValidationCheck } from './types.js';

export interface ValidationSpec {
  name: string;
  expectedText: string;
}

function extractText(output: unknown): string {
  if (typeof output === 'string') return output.toLowerCase();

  if (typeof output === 'object' && output !== null) {
    const obj = output as Record<string, unknown>;

    // MCP tool response: { content: [{ type: 'text', text: '...' }] }
    if (Array.isArray(obj['content'])) {
      return (obj['content'] as Array<{ type?: string; text?: string }>)
        .filter((c) => c.type === 'text')
        .map((c) => String(c.text ?? ''))
        .join(' ')
        .toLowerCase();
    }

    if (typeof obj['text'] === 'string') return obj['text'].toLowerCase();
    if (typeof obj['result'] === 'string') return obj['result'].toLowerCase();

    return JSON.stringify(output).toLowerCase();
  }

  return String(output ?? '').toLowerCase();
}

export function runTextValidations(
  specs: ValidationSpec[],
  results: ActionResult[],
): ValidationCheck[] {
  const allText = results
    .filter((r) => r.status === 'success')
    .map((r) => extractText(r.output))
    .join(' ');

  return specs.map((spec) => {
    const passed = allText.includes(spec.expectedText.toLowerCase());
    return {
      name: spec.name,
      passed,
      actual: passed ? spec.expectedText : '(not found)',
      expected: spec.expectedText,
      error: passed ? undefined : `Expected to find "${spec.expectedText}" in page content`,
    };
  });
}

export function runStructuralValidation(
  results: ActionResult[],
): ValidationCheck[] {
  const evaluateResult = results.find((r) => r.toolName === 'browser_evaluate');
  if (!evaluateResult || evaluateResult.status !== 'success') return [];

  let parsed: Record<string, unknown>;
  try {
    const raw = extractText(evaluateResult.output);
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return [];
  }

  const checks: ValidationCheck[] = [];

  const boolCheck = (key: string, label: string): void => {
    if (key in parsed) {
      const passed = parsed[key] === true;
      checks.push({
        name: label,
        passed,
        actual: String(parsed[key]),
        expected: 'true',
        error: passed ? undefined : `${label} was not found on the page`,
      });
    }
  };

  boolCheck('hasEmailOrUsername', 'Login form has email/username field');
  boolCheck('hasPassword', 'Login form has password field');
  boolCheck('hasSubmitButton', 'Login form has submit button');

  if ('pageTitle' in parsed) {
    checks.push({
      name: 'Page has a title',
      passed: String(parsed['pageTitle']).length > 0,
      actual: String(parsed['pageTitle']),
      expected: 'non-empty title',
    });
  }

  if ('url' in parsed) {
    checks.push({
      name: 'Page URL is reachable',
      passed: String(parsed['url']).startsWith('http'),
      actual: String(parsed['url']),
      expected: 'http(s) URL',
    });
  }

  return checks;
}
