import { describe, expect, it } from 'vitest';
import {
  getFirstMermaidDirective,
  getMermaidCodeForLooseSyntaxScan,
} from './mermaidDirective';

describe('mermaidDirective', () => {
  it('finds the first diagram directive after comments, init directives, and frontmatter', () => {
    expect(getFirstMermaidDirective([
      '---',
      'title: Example',
      '---',
      '',
      '%% leading comment',
      '%%{init: {',
      '  "theme": "base"',
      '} }%%',
      'ZenUML',
      '  Alice->Bob: Hi',
    ].join('\n'))).toBe('zenuml');
  });

  it('normalizes directive token separators and casing', () => {
    expect(getFirstMermaidDirective('flowchart-elk TD\nA --> B')).toBe('flowchartelk');
    expect(getFirstMermaidDirective('XYChart_beta\nx-axis [A]')).toBe('xychartbeta');
  });

  it('removes non-diagram metadata before loose incomplete-syntax scans', () => {
    expect(getMermaidCodeForLooseSyntaxScan([
      '---',
      'title: Example with {',
      '---',
      '%% comment with "unfinished',
      '%%{init: {"theme": "base"}}%%',
      'flowchart TD',
      '  A[Start] --> B[Done]',
    ].join('\n'))).toBe([
      'flowchart TD',
      '  A[Start] --> B[Done]',
    ].join('\n'));
  });
});
