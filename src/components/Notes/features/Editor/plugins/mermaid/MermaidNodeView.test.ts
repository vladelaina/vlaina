import { describe, expect, it } from 'vitest';
import { shouldRefreshMermaidElementCode } from './MermaidNodeView';
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
});
