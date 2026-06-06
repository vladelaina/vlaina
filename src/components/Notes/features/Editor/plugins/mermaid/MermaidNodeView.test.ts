import { describe, expect, it } from 'vitest';
import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { MermaidNodeView, shouldRefreshMermaidElementCode } from './MermaidNodeView';
import { createMermaidElement } from './mermaidDom';

describe('MermaidNodeView', () => {
  it('compares node updates against normalized Mermaid code', () => {
    const element = createMermaidElement('sequenceDiagram\nAlice->Bob: Hello');

    expect(
      shouldRefreshMermaidElementCode(element, 'sequence\nAlice->Bob: Hello')
    ).toBe(false);
  });

  it('refreshes when the normalized node code changes', () => {
    const element = createMermaidElement('sequenceDiagram\nAlice->Bob: Hello');

    expect(
      shouldRefreshMermaidElementCode(element, 'sequence\nAlice->Bob: Hi')
    ).toBe(true);
  });

  it('supports legacy data-code elements without writing new source code attributes', () => {
    const element = document.createElement('div');
    element.dataset.code = 'sequenceDiagram\nAlice->Bob: Hello';

    expect(
      shouldRefreshMermaidElementCode(element, 'sequence\nAlice->Bob: Hello')
    ).toBe(false);
  });

  it('adds Typora diagram aliases to Mermaid blocks', () => {
    const element = createMermaidElement('graph TD\nA-->B');

    expect(element.classList.contains('mermaid-block')).toBe(true);
    expect(element.classList.contains('theme-mermaid')).toBe(true);
    expect(element.classList.contains('md-fences')).toBe(true);
    expect(element.classList.contains('md-diagram')).toBe(true);
    expect(element.classList.contains('md-fences-advanced')).toBe(true);
    expect(element.classList.contains('md-diagram-panel')).toBe(true);
    expect(element.classList.contains('md-diagram-panel-preview')).toBe(true);
  });

  it('mirrors node selection to ProseMirror and Typora focus classes', () => {
    const nodeView = new MermaidNodeView(
      {
        attrs: { code: 'graph TD\nA-->B' },
        type: { name: 'mermaid' },
      } as unknown as Node,
      { root: document } as unknown as EditorView,
      () => 0
    );

    nodeView.selectNode();
    expect(nodeView.dom.classList.contains('ProseMirror-selectednode')).toBe(true);
    expect(nodeView.dom.classList.contains('md-focus')).toBe(true);

    nodeView.deselectNode();
    expect(nodeView.dom.classList.contains('ProseMirror-selectednode')).toBe(false);
    expect(nodeView.dom.classList.contains('md-focus')).toBe(false);

    nodeView.destroy();
  });
});
