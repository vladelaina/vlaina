import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mermaidRenderer', () => ({
  renderMermaid: vi.fn(async () => '<svg data-rendered="unexpected"></svg>'),
}));

import {
  clearMermaidRenderCaches,
  createMermaidElement,
  getMermaidElementCode,
  getPendingMermaidRenderCount,
  MAX_LEGACY_MERMAID_DATA_CODE_CHARS,
  MAX_PENDING_MERMAID_RENDERS,
  renderMermaidEditorLivePreview,
  resolveMermaidMarkup,
} from './mermaidDom';
import { renderMermaid } from './mermaidRenderer';

describe('mermaid DOM render bounds', () => {
  beforeEach(() => {
    clearMermaidRenderCaches();
    vi.mocked(renderMermaid).mockReset();
    vi.mocked(renderMermaid).mockResolvedValue('<svg data-rendered="unexpected"></svg>');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects oversized initial Mermaid elements before rendering', async () => {
    const element = createMermaidElement('x'.repeat(20_001));

    await Promise.resolve();
    await Promise.resolve();

    expect(renderMermaid).not.toHaveBeenCalled();
    expect(element.querySelector('.mermaid-error')?.textContent).toContain(
      'Diagram is too large to render.'
    );
    expect(element.querySelector('svg')).toBeNull();
  });

  it('rejects oversized live previews before rendering', async () => {
    const anchor = document.createElement('div');
    const render = vi.fn(async () => '<svg data-rendered="unexpected"></svg>');
    const onRendered = vi.fn();

    await renderMermaidEditorLivePreview({
      anchor,
      code: 'x'.repeat(20_001),
      render,
      onRendered,
    });

    expect(render).not.toHaveBeenCalled();
    expect(anchor.querySelector('.mermaid-error')?.textContent).toContain(
      'Diagram is too large to render.'
    );
    expect(anchor.querySelector('svg')).toBeNull();
    expect(onRendered).toHaveBeenCalledTimes(1);
  });

  it('short-circuits visibly incomplete live previews before rendering', async () => {
    const anchor = document.createElement('div');
    const render = vi.fn(async () => '<svg data-rendered="unexpected"></svg>');
    const onRendered = vi.fn();

    await renderMermaidEditorLivePreview({
      anchor,
      code: 'graph TD\nA --> B{unfinished',
      render,
      onRendered,
    });

    expect(render).not.toHaveBeenCalled();
    expect(anchor.querySelector('.mermaid-error')?.textContent).toContain(
      'Mermaid Error'
    );
    expect(anchor.querySelector('svg')).toBeNull();
    expect(onRendered).toHaveBeenCalledTimes(1);
  });

  it('bounds legacy data-code fallback reads', () => {
    const element = document.createElement('div');
    element.dataset.code = 'x'.repeat(MAX_LEGACY_MERMAID_DATA_CODE_CHARS + 1);

    expect(getMermaidElementCode(element)).toHaveLength(MAX_LEGACY_MERMAID_DATA_CODE_CHARS);
  });

  it('bounds pending default Mermaid renders for different diagrams', async () => {
    const renderResolves: Array<(markup: string) => void> = [];
    vi.mocked(renderMermaid).mockImplementation(
      () => new Promise((resolve) => {
        renderResolves.push(resolve);
      })
    );

    const renders = Array.from({ length: MAX_PENDING_MERMAID_RENDERS }, (_value, index) =>
      resolveMermaidMarkup(`sequenceDiagram\nAlice->>Bob: message ${index}`)
    );
    renders.forEach((render) => {
      render.catch(() => undefined);
    });

    expect(getPendingMermaidRenderCount()).toBe(MAX_PENDING_MERMAID_RENDERS);
    const overflowMarkup = await resolveMermaidMarkup('sequenceDiagram\nAlice->>Bob: overflow');

    expect(overflowMarkup).toContain('mermaid-error');
    expect(getPendingMermaidRenderCount()).toBe(MAX_PENDING_MERMAID_RENDERS);

    renderResolves.forEach((resolve, index) => {
      resolve(`<svg data-rendered="${index}"></svg>`);
    });
  });
});
