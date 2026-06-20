import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../src/mcp/manager/registry.js';
import type { MCPToolSchema } from '../../../src/shared/types.js';

const makeTool = (name: string): MCPToolSchema => ({
  name,
  description: `Tool ${name}`,
  inputSchema: { type: 'object', properties: {} },
});

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers and retrieves a tool by serverId + toolName', () => {
    registry.register('playwright', makeTool('browser_navigate'));
    const tool = registry.get('playwright', 'browser_navigate');
    expect(tool?.name).toBe('browser_navigate');
  });

  it('namespaces tools as {serverId}.{toolName}', () => {
    registry.register('playwright', makeTool('click'));
    registry.register('filesystem', makeTool('click'));
    expect(registry.keys()).toContain('playwright.click');
    expect(registry.keys()).toContain('filesystem.click');
    expect(registry.size).toBe(2);
  });

  it('getAll returns every registered tool', () => {
    registry.register('playwright', makeTool('navigate'));
    registry.register('playwright', makeTool('screenshot'));
    registry.register('filesystem', makeTool('read'));
    expect(registry.getAll()).toHaveLength(3);
  });

  it('getByServer returns only tools for the given server', () => {
    registry.register('playwright', makeTool('navigate'));
    registry.register('playwright', makeTool('screenshot'));
    registry.register('filesystem', makeTool('read'));
    const playwrightTools = registry.getByServer('playwright');
    expect(playwrightTools).toHaveLength(2);
    expect(playwrightTools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['navigate', 'screenshot']),
    );
  });

  it('overwriting a registration replaces the existing entry', () => {
    registry.register('playwright', makeTool('navigate'));
    const updated = { ...makeTool('navigate'), description: 'Updated' };
    registry.register('playwright', updated);
    expect(registry.size).toBe(1);
    expect(registry.get('playwright', 'navigate')?.description).toBe('Updated');
  });

  it('removeServer removes all tools for that server only', () => {
    registry.register('playwright', makeTool('navigate'));
    registry.register('filesystem', makeTool('read'));
    registry.removeServer('playwright');
    expect(registry.size).toBe(1);
    expect(registry.get('playwright', 'navigate')).toBeUndefined();
    expect(registry.get('filesystem', 'read')).toBeDefined();
  });

  it('clear empties the registry', () => {
    registry.register('playwright', makeTool('navigate'));
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('returns undefined for unregistered tool', () => {
    expect(registry.get('playwright', 'nonexistent')).toBeUndefined();
  });
});
