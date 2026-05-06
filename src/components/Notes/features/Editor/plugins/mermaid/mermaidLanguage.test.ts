import { describe, expect, it } from 'vitest';
import {
  isMermaidFenceLanguage,
  MERMAID_FENCE_LANGUAGE_ALIAS_LIST,
  normalizeMermaidFenceLanguage,
  parseMermaidFenceLanguage,
} from './mermaidLanguage';

describe('mermaidLanguage', () => {
  it('recognizes mermaid fence aliases used for diagrams', () => {
    const aliases = [
      'mermaid',
      'mmd',
      'info',
      'c4',
      'C4Context',
      'C4Container',
      'C4Component',
      'C4Dynamic',
      'C4Deployment',
      'flow',
      'flowchart',
      'flowchart-elk',
      'graph',
      'sequence',
      'sequenceDiagram',
      'class',
      'classDiagram',
      'classDiagram-v2',
      'state',
      'stateDiagram',
      'stateDiagram-v2',
      'er',
      'erDiagram',
      'gantt',
      'pie',
      'journey',
      'gitGraph',
      'mindmap',
      'timeline',
      'treeView',
      'treeView-beta',
      'quadrant',
      'quadrantChart',
      'xychart',
      'xychart-beta',
      'requirement',
      'requirementDiagram',
      'sankey',
      'sankey-beta',
      'packet',
      'packet-beta',
      'radar',
      'radar-beta',
      'block',
      'block-beta',
      'architecture',
      'architecture-beta',
      'kanban',
      'ishikawa',
      'ishikawa-beta',
      'venn',
      'venn-beta',
      'treemap',
      'treemap-beta',
      'wardley',
      'wardley-beta',
      'zenuml',
    ];

    expect(new Set(MERMAID_FENCE_LANGUAGE_ALIAS_LIST).size).toBe(
      MERMAID_FENCE_LANGUAGE_ALIAS_LIST.length
    );
    for (const alias of aliases) {
      expect(isMermaidFenceLanguage(alias), alias).toBe(true);
    }
  });

  it('normalizes spacing and separators in fence names', () => {
    expect(normalizeMermaidFenceLanguage(' sequence-diagram ')).toBe('sequencediagram');
    expect(isMermaidFenceLanguage('state_diagram')).toBe(true);
  });

  it('recognizes Mermaid fence info strings with Markdown metadata', () => {
    expect(normalizeMermaidFenceLanguage('mermaid title="Flow"')).toBe('mermaid');
    expect(isMermaidFenceLanguage('sequence data-extra')).toBe(true);
  });

  it('parses supported backtick fences and rejects normal code fences', () => {
    expect(parseMermaidFenceLanguage('```mermaid')).toBe('mermaid');
    expect(parseMermaidFenceLanguage('```mermaid title="Flow"')).toBe('mermaid');
    expect(parseMermaidFenceLanguage('``` mermaid title="Flow"')).toBe('mermaid');
    expect(parseMermaidFenceLanguage('~~~mermaid')).toBe('mermaid');
    expect(parseMermaidFenceLanguage('~~~sequence title="Sequence"')).toBe('sequence');
    expect(parseMermaidFenceLanguage('~~~sequence title="A ~ B"')).toBe('sequence');
    expect(parseMermaidFenceLanguage('~~~ sequence title="Sequence"')).toBe('sequence');
    expect(parseMermaidFenceLanguage('```flow')).toBe('flow');
    expect(parseMermaidFenceLanguage('```zenuml')).toBe('zenuml');
    expect(parseMermaidFenceLanguage('```ts')).toBeNull();
    expect(parseMermaidFenceLanguage('```mermaid `bad`')).toBeNull();
    expect(parseMermaidFenceLanguage('``mermaid')).toBeNull();
    expect(parseMermaidFenceLanguage('~~mermaid')).toBeNull();
    expect(parseMermaidFenceLanguage('    ```mermaid')).toBeNull();
  });
});
