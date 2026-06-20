export interface PageObjectSpec {
  className: string;
  selectors: Record<string, string>;
  actions: string[];
}

export function generatePageObject(spec: PageObjectSpec): string {
  const { className, selectors, actions } = spec;

  const selectorProps = Object.entries(selectors)
    .map(([name, sel]) => `  readonly ${name} = this.page.locator('${sel}');`)
    .join('\n');

  const actionMethods = actions
    .map((action) => {
      const camel = action.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase());
      return `  async ${camel}(): Promise<void> {\n    // TODO: implement ${action}\n  }`;
    })
    .join('\n\n');

  return [
    `import { type Page } from '@playwright/test';`,
    ``,
    `export class ${className} {`,
    `  constructor(private readonly page: Page) {}`,
    ``,
    selectorProps,
    ``,
    actionMethods,
    `}`,
  ].join('\n');
}
