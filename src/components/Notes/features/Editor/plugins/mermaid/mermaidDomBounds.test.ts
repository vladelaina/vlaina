import { describe, expect, it, vi } from 'vitest';

vi.mock('./mermaidRenderer', () => ({
  renderMermaid: vi.fn(async () => '<svg data-rendered="unexpected"></svg>'),
}));

import {
  createMermaidElement,
  renderMermaidEditorLivePreview,
} from './mermaidDom';
import { renderMermaid } from './mermaidRenderer';

describe('mermaid DOM render bounds', () => {
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
});
