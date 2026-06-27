import { describe, expect, it } from 'vitest';
import { getMarkdownBodyLineNumbers } from './bodyLineNumbers';

describe('getMarkdownBodyLineNumbers', () => {
  it('starts dense body numbering after hidden leading frontmatter', () => {
    const markdown = [
      '---',
      'vlaina_created: 2026-01-01T00:00:00.000Z',
      'vlaina_updated: 2026-01-02T00:00:00.000Z',
      '---',
      '# Title',
      'Body',
    ].join('\n');

    expect(getMarkdownBodyLineNumbers(markdown)).toEqual([1, 2]);
  });

  it('numbers fenced code blocks by visible code lines', () => {
    const markdown = [
      '# Title',
      '```ts',
      'const value = 1;',
      'const next = 2;',
      '```',
      'After code',
    ].join('\n');

    expect(getMarkdownBodyLineNumbers(markdown)).toEqual([1, 2, 3, 4]);
  });

  it('numbers ordinary and diagram fences as rendered body blocks', () => {
    const markdown = [
      '```ts',
      'const value = 1;',
      '```',
      '',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```',
      '',
      '```sequence',
      'Alice->Bob: Hi',
      '```',
      '',
      'After diagrams',
    ].join('\n');

    expect(getMarkdownBodyLineNumbers(markdown)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('numbers top-level indented code blocks without counting list continuations', () => {
    const markdown = [
      '- List item',
      '    list continuation code stays inside the list item',
      '',
      '    top level indented code',
      '    second indented code line',
      '',
      'After code',
    ].join('\n');

    expect(getMarkdownBodyLineNumbers(markdown)).toEqual([1, 2, 3, 4, 5]);
  });

  it('numbers user-visible blank line placeholders', () => {
    const markdown = [
      '# Title',
      '<!--vlaina-markdown-blank-line-->',
      '<!-- vlaina-rendered-html-boundary-blank-line -->',
      'Body',
    ].join('\n');

    expect(getMarkdownBodyLineNumbers(markdown)).toEqual([1, 2, 3, 4]);
  });

  it('numbers raw markdown blank lines that render as editable body lines', () => {
    const markdown = [
      'Before placeholder',
      '',
      'After placeholder',
    ].join('\n');

    expect(getMarkdownBodyLineNumbers(markdown)).toEqual([1, 2, 3]);
  });

  it('skips editor-only tight heading placeholders', () => {
    const markdown = [
      '# Before',
      '<!--vlaina-markdown-tight-heading-->',
      '## After',
    ].join('\n');

    expect(getMarkdownBodyLineNumbers(markdown)).toEqual([1, 2]);
  });

  it('returns dense body line numbers for list items and nested list items', () => {
    const markdown = [
      '- One',
      '  continuation',
      '  - Nested',
      '- Two',
    ].join('\n');

    expect(getMarkdownBodyLineNumbers(markdown)).toEqual([1, 2, 3]);
  });

  it('numbers visible list gap placeholders created from blank lines between list items', () => {
    const markdown = [
      '- One',
      '',
      '- Two',
    ].join('\n');

    expect(getMarkdownBodyLineNumbers(markdown)).toEqual([1, 2, 3]);
  });
});
