import { describe, expect, it, vi } from 'vitest';

vi.mock('./mermaidRenderer', () => ({
  generateMermaidId: () => 'mermaid-test',
  renderMermaid: vi.fn(async () => '<svg data-rendered="initial"></svg>'),
}));

import { createMermaidElement, getMermaidElementCode, renderMermaidEditorLivePreview } from './mermaidDom';
import { renderMermaid } from './mermaidRenderer';

describe('mermaidEditorLivePreview', () => {
  it('normalizes code before the first Mermaid element render', () => {
    const element = createMermaidElement('sequence\nAlice->Bob: Hello');

    expect(getMermaidElementCode(element)).toBe('sequenceDiagram\nAlice->Bob: Hello');
    expect(element.dataset.code).toBeUndefined();
  });

  it('does not expose Mermaid source code in serialized element HTML', async () => {
    const element = createMermaidElement('sequenceDiagram\nAlice->Bob: secret token');

    await Promise.resolve();
    await Promise.resolve();

    expect(getMermaidElementCode(element)).toBe('sequenceDiagram\nAlice->Bob: secret token');
    expect(element.outerHTML).not.toContain('sequenceDiagram');
    expect(element.outerHTML).not.toContain('secret token');
    expect(element.outerHTML).not.toContain('data-code');
  });

  it('allows the initial render to complete before the node is attached', async () => {
    const element = createMermaidElement('sequenceDiagram\nAlice->Bob: Hello');

    await Promise.resolve();
    await Promise.resolve();

    expect(element.querySelector('svg, .mermaid-error')).not.toBeNull();
    expect(getMermaidElementCode(element)).toBe('sequenceDiagram\nAlice->Bob: Hello');
  });

  it('shows a generic error when the initial Mermaid render rejects', async () => {
    vi.mocked(renderMermaid).mockRejectedValueOnce(new Error('secret source'));

    const element = createMermaidElement('sequenceDiagram\nAlice->Bob: secret source');

    await Promise.resolve();
    await Promise.resolve();

    expect(element.querySelector('.mermaid-error')?.textContent).toContain(
      'Mermaid Error: Unable to render diagram.'
    );
    expect(element.outerHTML).not.toContain('secret source');
  });

  it('renders whitespace-only Mermaid elements as empty diagrams', () => {
    const element = createMermaidElement('   \n\t');

    expect(getMermaidElementCode(element)).toBe('   \n\t');
    expect(element.dataset.code).toBeUndefined();
    expect(element.querySelector('.mermaid-empty')?.textContent).toBe('Empty diagram');
  });

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

    expect(getMermaidElementCode(anchor)).toBe('');
    expect(anchor.dataset.code).toBeUndefined();
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
        await renderMermaidEditorLivePreview({
          anchor,
          code: 'newer',
          render: async () => '<svg data-rendered="newer"></svg>',
        });
        return '<svg data-rendered="older"></svg>';
      },
    });

    expect(anchor.querySelector('[data-rendered="older"]')).toBeNull();
    expect(getMermaidElementCode(anchor)).toBe('newer');
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

    expect(getMermaidElementCode(anchor)).toBe('graph TD');
    expect(anchor.dataset.code).toBeUndefined();
    expect(anchor.outerHTML).not.toContain('graph TD');
    expect(anchor.outerHTML).not.toContain('data-code');
    expect(anchor.querySelector('[data-rendered="current"]')).not.toBeNull();
    expect(onRendered).toHaveBeenCalledTimes(1);
  });

  it('keeps live preview usable when a custom render rejects', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-type', 'mermaid');
    document.body.appendChild(anchor);
    const onRendered = vi.fn();

    await renderMermaidEditorLivePreview({
      anchor,
      code: 'sequenceDiagram\nAlice->Bob: secret source',
      render: async () => {
        throw new Error('secret source');
      },
      onRendered,
    });

    expect(getMermaidElementCode(anchor)).toBe('sequenceDiagram\nAlice->Bob: secret source');
    expect(anchor.querySelector('.mermaid-error')?.textContent).toContain(
      'Mermaid Error: Unable to render diagram.'
    );
    expect(anchor.outerHTML).not.toContain('secret source');
    expect(onRendered).toHaveBeenCalledTimes(1);
  });

  it('previews pasted fenced Mermaid input as normalized diagram code', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-type', 'mermaid');
    document.body.appendChild(anchor);
    const render = vi.fn(async () => '<svg data-rendered="sequence"></svg>');

    await renderMermaidEditorLivePreview({
      anchor,
      code: [
        '```sequence',
        'Alice->Bob: Hello Bob, how are you?',
        'Note right of Bob: Bob thinks',
        'Bob-->Alice: I am good thanks!',
        '```',
      ].join('\n'),
      render,
    });

    expect(render).toHaveBeenCalledWith(
      [
        'sequenceDiagram',
        'Alice->Bob: Hello Bob, how are you?',
        'Note right of Bob: Bob thinks',
        'Bob-->Alice: I am good thanks!',
      ].join('\n'),
      expect.stringMatching(/^mermaid-/)
    );
    expect(getMermaidElementCode(anchor)).toBe([
      'sequenceDiagram',
      'Alice->Bob: Hello Bob, how are you?',
      'Note right of Bob: Bob thinks',
      'Bob-->Alice: I am good thanks!',
    ].join('\n'));
  });
});
