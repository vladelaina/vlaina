import { describe, expect, it, vi } from 'vitest';
import { createMermaidElement, renderMermaidEditorLivePreview } from './mermaidDom';

describe('mermaidEditorLivePreview', () => {
  it('normalizes code before the first Mermaid element render', () => {
    const element = createMermaidElement('sequence\nAlice->Bob: Hello');

    expect(element.dataset.code).toBe('sequenceDiagram\nAlice->Bob: Hello');
  });

  it('renders whitespace-only Mermaid elements as empty diagrams', () => {
    const element = createMermaidElement('   \n\t');

    expect(element.dataset.code).toBe('   \n\t');
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
    expect(anchor.dataset.code).toBe([
      'sequenceDiagram',
      'Alice->Bob: Hello Bob, how are you?',
      'Note right of Bob: Bob thinks',
      'Bob-->Alice: I am good thanks!',
    ].join('\n'));
  });
});
