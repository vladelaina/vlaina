import { describe, expect, it } from 'vitest';
import { normalizeMermaidFenceCode } from './mermaidFenceCode';

describe('normalizeMermaidFenceCode', () => {
  it('adds the Mermaid sequence directive for legacy sequence fenced content', () => {
    expect(normalizeMermaidFenceCode('sequence', 'Alice->Bob: Hello')).toBe(
      'sequenceDiagram\nAlice->Bob: Hello'
    );
  });

  it('does not duplicate an existing Mermaid diagram directive', () => {
    expect(normalizeMermaidFenceCode('sequence', 'sequenceDiagram\nAlice->>Bob: Hello')).toBe(
      'sequenceDiagram\nAlice->>Bob: Hello'
    );
  });

  it('leaves other Mermaid aliases unchanged', () => {
    expect(normalizeMermaidFenceCode('flowchart', 'flowchart TD\nA --> B')).toBe(
      'flowchart TD\nA --> B'
    );
  });
});
