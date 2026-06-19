export interface PageObjectSpec {
  className: string;
  selectors: Record<string, string>;
  actions: string[];
}

export function generatePageObject(_spec: PageObjectSpec): string {
  throw new Error('generatePageObject() not yet implemented — see task 15.1');
}
