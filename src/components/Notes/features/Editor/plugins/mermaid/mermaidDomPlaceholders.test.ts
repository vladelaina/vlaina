import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
  translate: (key: string) => {
    if (key === 'editor.mermaidRenderError') return '<img src=x onerror=alert(1)> error';
    return key;
  },
}));

import { createMermaidElement, renderMermaidEditorLivePreview } from './mermaidDom';

describe('mermaid placeholder markup', () => {
  it('renders empty placeholders without translated copy and escapes error placeholders', async () => {
    const emptyElement = createMermaidElement('');
    const emptyPlaceholder = emptyElement.querySelector('.mermaid-empty');

    expect(emptyElement.querySelector('img')).toBeNull();
    expect(emptyPlaceholder?.textContent).toBe('\u200b');
    expect(emptyPlaceholder?.getAttribute('aria-hidden')).toBe('true');

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
