import { describe, expect, it } from 'vitest';
import { getMermaidDiagramType } from './mermaidDiagramType';

describe('getMermaidDiagramType', () => {
  it('detects Gantt after Mermaid comments and init directives', () => {
    expect(getMermaidDiagramType([
      '%% Example with selection of syntaxes',
      '%%{init: {"theme": "base"}}%%',
      'gantt',
      'dateFormat YYYY-MM-DD',
    ].join('\n'))).toBe('gantt');
  });

  it('detects Gantt after YAML frontmatter', () => {
    expect(getMermaidDiagramType([
      '---',
      'title: Schedule',
      '---',
      '',
      'gantt',
      'dateFormat YYYY-MM-DD',
    ].join('\n'))).toBe('gantt');
  });

  it('does not mark ordinary Mermaid diagrams as Gantt', () => {
    expect(getMermaidDiagramType('flowchart TD\nA --> B')).toBeNull();
    expect(getMermaidDiagramType('sequenceDiagram\nAlice->Bob: Hi')).toBeNull();
  });
});
