import { describe, expect, it, vi } from 'vitest';
import { renderMermaidEditorLivePreview } from './mermaidDom';

describe('mermaidEditorLivePreview', () => {
  it('updates empty previews immediately without dispatching through the editor', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-type', 'mermaid');
    anchor.dataset.code = 'graph TD';
    anchor.innerHTML = '<svg></svg>';

    await renderMermaidEditorLivePreview({
      anchor,
      code: '',
      onRendered: vi.fn(),
    });

    expect(anchor.dataset.code).toBe('');
    expect(anchor.querySelector('.mermaid-empty')?.textContent).toBe('Empty diagram');
  });

  it('ignores stale async renders when a newer draft is already present', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-type', 'mermaid');
    document.body.appendChild(anchor);

    await renderMermaidEditorLivePreview({
      anchor,
      code: 'older',
      render: async () => {
        anchor.dataset.code = 'newer';
        return '<svg data-rendered="older"></svg>';
      },
    });

    expect(anchor.querySelector('[data-rendered="older"]')).toBeNull();
    expect(anchor.dataset.code).toBe('newer');
  });

  it('notifies after a current async render lands', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-type', 'mermaid');
    document.body.appendChild(anchor);
    const onRendered = vi.fn();

    await renderMermaidEditorLivePreview({
      anchor,
      code: 'graph TD',
      render: async () => '<svg data-rendered="current"></svg>',
      onRendered,
    });

    expect(anchor.dataset.code).toBe('graph TD');
    expect(anchor.querySelector('[data-rendered="current"]')).not.toBeNull();
    expect(onRendered).toHaveBeenCalledTimes(1);
  });

  it('sanitizes rendered svg before attaching it to the document', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-type', 'mermaid');
    document.body.appendChild(anchor);

    await renderMermaidEditorLivePreview({
      anchor,
      code: 'graph TD',
      render: async () => [
        '<svg onload="alert(1)">',
        '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
        '<a href="javascript:alert(1)"><text>bad</text></a>',
        '<text>safe</text>',
        '</svg>',
      ].join(''),
    });

    expect(anchor.querySelector('svg')).not.toBeNull();
    expect(anchor.querySelector('foreignObject')).toBeNull();
    expect(anchor.querySelector('iframe')).toBeNull();
    expect(anchor.innerHTML).not.toContain('onload');
    expect(anchor.innerHTML).not.toContain('javascript:');
    expect(anchor.textContent).toContain('safe');
  });
});
