import type { MCPToolSchema } from '@shared/types.js';
import type { PlannedAction } from './types.js';

export interface PlannerResult {
  actions: PlannedAction[];
  reasoning: string;
}

const TOOL_KEYWORDS: Record<string, string[]> = {
  browser_navigate: ['open', 'navigate', 'go to', 'visit', 'url', 'website', 'page', 'load'],
  browser_screenshot: ['screenshot', 'capture', 'snapshot', 'visual'],
  browser_click: ['click', 'press', 'tap', 'submit', 'button', 'link'],
  browser_type: ['type', 'enter', 'input', 'fill', 'write', 'username', 'password', 'email'],
  browser_wait_for: ['wait', 'until', 'appear', 'visible', 'ready', 'loaded'],
  browser_get_text: ['text', 'content', 'read', 'get', 'extract', 'title', 'heading'],
  browser_evaluate: ['evaluate', 'javascript', 'js', 'script', 'check', 'assert'],
};

const LOGIN_PAGE_CHECKS = [
  'email',
  'username',
  'password',
  'login',
  'sign in',
  'submit',
  'forgot password',
];

function scoreToolForTask(toolName: string, task: string): number {
  const keywords = TOOL_KEYWORDS[toolName] ?? [];
  const lowerTask = task.toLowerCase();
  return keywords.filter((kw) => lowerTask.includes(kw)).length;
}

function extractUrl(task: string): string {
  const urlMatch = task.match(/https?:\/\/[^\s"']+/);
  if (urlMatch) return urlMatch[0];

  const domainMatch = task.match(/\b(www\.[a-z0-9.-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|org|net|io|dev|app))\b/i);
  if (domainMatch) return `https://${domainMatch[0]}`;

  return 'https://example.com';
}

export function planActions(
  task: string,
  availableTools: MCPToolSchema[],
  serverId: string,
): PlannerResult {
  const toolNames = new Set(availableTools.map((t) => t.name));
  const lowerTask = task.toLowerCase();
  const actions: PlannedAction[] = [];
  const reasoning: string[] = [];

  const has = (tool: string): boolean => toolNames.has(tool);

  // 1. Navigate
  if (scoreToolForTask('browser_navigate', task) > 0 || lowerTask.includes('open')) {
    if (has('browser_navigate')) {
      const url = extractUrl(task);
      actions.push({
        id: 'action-1',
        toolName: 'browser_navigate',
        serverId,
        input: { url },
        description: `Navigate to ${url}`,
        retries: 0,
      });
      reasoning.push(`Task mentions opening/navigating — will navigate to ${url}`);
    }
  }

  // 2. Screenshot after navigation
  if (has('browser_screenshot') && actions.length > 0) {
    actions.push({
      id: `action-${actions.length + 1}`,
      toolName: 'browser_screenshot',
      serverId,
      input: {},
      description: 'Capture screenshot of loaded page',
      retries: 0,
    });
    reasoning.push('Screenshot after navigation to capture initial state');
  }

  // 3. Login page validation
  const isLoginTask =
    lowerTask.includes('login') ||
    lowerTask.includes('sign in') ||
    lowerTask.includes('validate login') ||
    lowerTask.includes('login page');

  if (isLoginTask) {
    // Get page text to check for login elements
    if (has('browser_get_text')) {
      actions.push({
        id: `action-${actions.length + 1}`,
        toolName: 'browser_get_text',
        serverId,
        input: { selector: 'body' },
        description: 'Extract page text for login element validation',
        retries: 0,
      });
      reasoning.push('Login page validation — extracting page text to check for form elements');
    }

    // Check for specific login form fields via evaluate
    if (has('browser_evaluate')) {
      const checkScript = `
        const checks = {
          hasEmailOrUsername: !!(
            document.querySelector('input[type="email"]') ||
            document.querySelector('input[name="email"]') ||
            document.querySelector('input[name="username"]') ||
            document.querySelector('input[type="text"]')
          ),
          hasPassword: !!document.querySelector('input[type="password"]'),
          hasSubmitButton: !!(
            document.querySelector('button[type="submit"]') ||
            document.querySelector('input[type="submit"]') ||
            document.querySelector('button')
          ),
          pageTitle: document.title,
          url: window.location.href,
        };
        return JSON.stringify(checks);
      `.trim();

      actions.push({
        id: `action-${actions.length + 1}`,
        toolName: 'browser_evaluate',
        serverId,
        input: { script: checkScript },
        description: 'Check for presence of email/username, password, and submit button',
        retries: 0,
      });
      reasoning.push('Running JS evaluation to detect login form elements programmatically');
    }

    // Final screenshot with form visible
    if (has('browser_screenshot')) {
      actions.push({
        id: `action-${actions.length + 1}`,
        toolName: 'browser_screenshot',
        serverId,
        input: {},
        description: 'Final screenshot showing login page state',
        retries: 0,
      });
      reasoning.push('Final screenshot to capture login form for the report');
    }
  }

  // 4. Generic wait if nothing planned yet beyond navigate
  if (actions.length === 1 && has('browser_wait_for')) {
    actions.push({
      id: `action-${actions.length + 1}`,
      toolName: 'browser_wait_for',
      serverId,
      input: { selector: 'body', state: 'visible' },
      description: 'Wait for page body to be visible',
      retries: 0,
    });
  }

  // Fallback: at minimum navigate + screenshot
  if (actions.length === 0) {
    const url = extractUrl(task);
    if (has('browser_navigate')) {
      actions.push({
        id: 'action-1',
        toolName: 'browser_navigate',
        serverId,
        input: { url },
        description: `Navigate to ${url}`,
        retries: 0,
      });
    }
    if (has('browser_screenshot')) {
      actions.push({
        id: 'action-2',
        toolName: 'browser_screenshot',
        serverId,
        input: {},
        description: 'Capture screenshot',
        retries: 0,
      });
    }
    reasoning.push('Fallback plan: navigate and screenshot');
  }

  return { actions, reasoning: reasoning.join('; ') };
}

export function buildLoginValidations(
  task: string,
): Array<{ name: string; expectedText: string }> {
  const lowerTask = task.toLowerCase();
  if (
    !lowerTask.includes('login') &&
    !lowerTask.includes('sign in') &&
    !lowerTask.includes('validate login')
  ) {
    return [];
  }
  return LOGIN_PAGE_CHECKS.map((check) => ({
    name: `Login page has "${check}"`,
    expectedText: check,
  }));
}
