import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const zenumlDiagram = { id: 'zenuml' };
const registerExternalDiagrams = vi.fn(async () => undefined);
const initialize = vi.fn();
const render = vi.fn(async (_id: string, code: string) => {
  console.log('core rendering', code);
  return { svg: '<svg data-testid="diagram"></svg>' };
});

vi.mock('@mermaid-js/mermaid-zenuml', () => ({
  default: zenumlDiagram,
}));

vi.mock('mermaid', () => ({
  default: {
    initialize,
    registerExternalDiagrams,
    render,
  },
}));

describe('mermaidRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the ZenUML external diagram before rendering', async () => {
    const { renderMermaid } = await import('./mermaidRenderer');

    const svg = await renderMermaid('zenuml\nAlice->Bob: Hi', 'diagram-1');

    expect(svg).toBe('<svg data-testid="diagram"></svg>');
    expect(initialize).toHaveBeenLastCalledWith(expect.objectContaining({
      flowchart: {
        htmlLabels: false,
      },
      theme: 'base',
      themeVariables: expect.objectContaining({
        background: '#FFFFFF',
        primaryTextColor: '#27272A',
      }),
    }));
    expect(registerExternalDiagrams).toHaveBeenCalledWith([zenumlDiagram]);
    expect(render).toHaveBeenCalledWith('diagram-1', 'zenuml\nAlice->Bob: Hi');
    expect(registerExternalDiagrams.mock.invocationCallOrder[0]).toBeLessThan(
      render.mock.invocationCallOrder[0]
    );
  });

  it('uses the built-in beautiful Mermaid default render theme', async () => {
    const { renderMermaid } = await import('./mermaidRenderer');

    await renderMermaid('graph TD\nA-->B', 'diagram-1');

    expect(initialize).toHaveBeenLastCalledWith(expect.objectContaining({
      theme: 'base',
      themeVariables: expect.objectContaining({
        background: '#FFFFFF',
        primaryTextColor: '#27272A',
      }),
    }));
  });

  it('suppresses third-party renderer console output so diagram source is not leaked', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { renderMermaid } = await import('./mermaidRenderer');

    await renderMermaid('zenuml\nAlice->Bob: Hi', 'diagram-1');

    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    console.log('after render');
    expect(consoleLog).toHaveBeenCalledWith('after render');
  });

  it('does not expose diagram source in rendered error messages', async () => {
    render.mockRejectedValueOnce(new Error('No diagram type detected for text: zenuml\nAlice->Bob: secret'));
    const { renderMermaid } = await import('./mermaidRenderer');

    const html = await renderMermaid('zenuml\nAlice->Bob: secret', 'diagram-1');

    expect(html).toContain('Mermaid Error: Unable to render diagram.');
    expect(html).not.toContain('Alice->Bob');
    expect(html).not.toContain('secret');
  });
});
