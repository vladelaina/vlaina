import { describe, expect, it } from 'vitest';
import { shouldRefreshMermaidElementCode } from './MermaidNodeView';

describe('MermaidNodeView', () => {
  it('compares node updates against normalized Mermaid code', () => {
    const element = document.createElement('div');
    element.dataset.code = 'sequenceDiagram\nAlice->Bob: Hello';

    expect(
      shouldRefreshMermaidElementCode(element, 'sequence\nAlice->Bob: Hello')
    ).toBe(false);
  });

  it('refreshes when the normalized node code changes', () => {
    const element = document.createElement('div');
    element.dataset.code = 'sequenceDiagram\nAlice->Bob: Hello';

    expect(
      shouldRefreshMermaidElementCode(element, 'sequence\nAlice->Bob: Hi')
    ).toBe(true);
  });
});
