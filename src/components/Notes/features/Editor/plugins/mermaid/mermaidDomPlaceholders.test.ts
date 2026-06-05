import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
  translate: (key: string) => {
    if (key === 'editor.emptyDiagram') return '<img src=x onerror=alert(1)> empty';
    if (key === 'editor.mermaidRenderError') return '<img src=x onerror=alert(1)> error';
    return key;
  },
}));

import { createMermaidElement, renderMermaidEditorLivePreview } from './mermaidDom';

describe('mermaid placeholder markup', () => {
  it('escapes translated empty and error placeholders before writing them as html', async () => {
    const emptyElement = createMermaidElement('');
    expect(emptyElement.querySelector('img')).toBeNull();
    expect(emptyElement.querySelector('.mermaid-empty')?.textContent).toBe('<img src=x onerror=alert(1)> empty');

    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    await renderMermaidEditorLivePreview({
      anchor,
      code: 'graph TD',
      render: async () => {
        throw new Error('render failed');
      },
    });

    expect(anchor.querySelector('img')).toBeNull();
    expect(anchor.querySelector('.mermaid-error')?.textContent).toBe('<img src=x onerror=alert(1)> error');
  });
});
