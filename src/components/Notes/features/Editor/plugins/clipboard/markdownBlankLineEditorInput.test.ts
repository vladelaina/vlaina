import { describe, expect, it } from 'vitest';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
} from '@/lib/notes/markdown/markdownSerializationUtils';

const LEGACY_EMPTY_LINE_PLACEHOLDER = '\u200B';

describe('preserveMarkdownBlankLinesForEditor editor input', () => {
  it('keeps ordinary markdown blank lines as paragraph boundaries', () => {
    expect(preserveMarkdownBlankLinesForEditor('1\n\n2')).toBe('1\n\n2');
  });

  it('keeps ordinary body blank lines after leading frontmatter', () => {
    const markdown = [
      '---',
      'vlaina_icon: "note"',
      'vlaina_updated: "2026-05-05T03:12:51.625Z"',
      '---',
      '1',
      '',
      '2',
      '',
      '3',
      '',
      '4',
      '',
    ].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('caps pathological body blank line runs before they become editor nodes', () => {
    const blankRun = Array.from({ length: 200 }, () => '').join('\n');
    const markdown = ['before', blankRun, 'after'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput.split('\n').length).toBeLessThan(40);
    expect(editorInput).toContain('before');
    expect(editorInput).toContain('after');
  });

  it('does not cap long blank line runs inside fenced code blocks', () => {
    const blankRun = Array.from({ length: 20 }, () => '').join('\n');
    const markdown = ['```', 'before', blankRun, 'after', '```'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('handles long blank line runs inside indented code blocks within the default test timeout', () => {
    const blankRun = Array.from({ length: 8_000 }, () => '').join('\n');
    const markdown = ['    before', blankRun, '    after', '', 'body'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not expose internal user break markers in editor input', () => {
    expect(preserveMarkdownBlankLinesForEditor(['1', '<br />', '2'].join('\n'))).toBe(
      ['1\\', '2'].join('\n')
    );
  });

  it('escapes plain text trailing backslashes before editor parsing', () => {
    const markdown = [
      '7）视图模式：支持大纲和文档列表视图，方便在不同段落和不同文件之间进行切换。\\',
      '8）跨平台：支持macOS、Windows和Linux系统。\\',
      '9）目前免费：这么好用的编辑器竟然是免费的。',
    ].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe([
      '7）视图模式：支持大纲和文档列表视图，方便在不同段落和不同文件之间进行切换。\\\\\\',
      '8）跨平台：支持macOS、Windows和Linux系统。\\\\\\',
      '9）目前免费：这么好用的编辑器竟然是免费的。',
    ].join('\n'));
  });

  it('keeps structural markdown trailing backslashes as hard breaks', () => {
    const markdown = ['- item\\', '- next'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not add placeholders inside fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(
        ['```ts', 'const a = 1;', '', 'const b = 2;', '```', '', 'after'].join('\n')
      )
    ).toBe(
      ['```ts', 'const a = 1;', '', 'const b = 2;', '```', '', 'after'].join('\n')
    );
  });

  it('does not rewrite br-only lines inside fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['```html', '<br />', '```'].join('\n'))
    ).toBe(['```html', '<br />', '```'].join('\n'));
  });

  it('does not rewrite list-like gaps inside fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['```md', '- one', '', '- two', '```'].join('\n'))
    ).toBe(['```md', '- one', '', '- two', '```'].join('\n'));
  });

  it('does not rewrite content inside blockquote fenced code blocks', () => {
    const markdown = ['> ```md', '> - one', '>', '> - two', '> ```'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not rewrite content inside nested blockquote fenced code blocks', () => {
    const markdown = ['> > ```md', '> > - one', '> >', '> > - two', '> > ```'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not add placeholders inside normalized frontmatter fences', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(
        ['```yaml-frontmatter', 'title: Demo', '', 'summary: Test', '```', '', '# Heading'].join('\n')
      )
    ).toBe(
      [
        '```yaml-frontmatter',
        'title: Demo',
        '',
        'summary: Test',
        '```',
        '',
        '# Heading',
      ].join('\n')
    );
  });

  it('matches fenced code closers by marker and length', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['````', '```', '', 'code', '````', '', 'after'].join('\n'))
    ).toBe(['````', '```', '', 'code', '````', '', 'after'].join('\n'));
  });

  it('does not close a fenced code block with a content line that only starts with a fence', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['```', '```still code', '', '```', '', 'after'].join('\n'))
    ).toBe(['```', '```still code', '', '```', '', 'after'].join('\n'));
  });

  it('does not treat indented code as fenced code', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['    ```', '', 'after'].join('\n'))
    ).toBe(['    ```', '', 'after'].join('\n'));
  });

  it('does not add placeholders inside indented code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['    line 1', '', '    line 2', '', 'after'].join('\n'))
    ).toBe(['    line 1', '', '    line 2', '', 'after'].join('\n'));
  });

  it('does not add placeholders inside tab-indented code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['\tline 1', '', '\tline 2', '', 'after'].join('\n'))
    ).toBe(['\tline 1', '', '\tline 2', '', 'after'].join('\n'));
  });

  it('detects indented code blocks after paragraph breaks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['before', '', '    line 1', '', '    line 2'].join('\n'))
    ).toBe(['before', '', '    line 1', '', '    line 2'].join('\n'));
  });

  it('keeps structural blank lines before fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['before', '', '```ts', 'const value = 1;', '```'].join('\n'))
    ).toBe(['before', '', '```ts', 'const value = 1;', '```'].join('\n'));
  });

  it('keeps structural blank lines before nested fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor([
        '- item',
        '',
        '  detail',
        '',
        '  ```ts',
        '  const value = 1;',
        '  ```',
      ].join('\n'))
    ).toBe([
      '- item',
      '',
      '  detail',
      '',
      '  ```ts',
      '  const value = 1;',
      '  ```',
    ].join('\n'));
  });

  it('keeps trailing document blank lines after indented text', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['    line', ''].join('\n'))
    ).toBe(['    line', ''].join('\n'));
  });

  it('does not rewrite placeholder-like text inside indented code blocks', () => {
    const markdown = [`    ${LEGACY_EMPTY_LINE_PLACEHOLDER}`, '', '    <br />', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('does not treat backtick fences with backticks in the info string as fenced code', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['``` invalid ` info', '', 'after'].join('\n'))
    ).toBe(['``` invalid ` info', '', 'after'].join('\n'));
  });

  it('does not treat mixed backtick and tilde marker runs as fenced code', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['``~', '', 'after'].join('\n'))
    ).toBe(['``~', '', 'after'].join('\n'));
  });

  it('does not add placeholders inside raw html blocks that allow blank lines', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['<pre>', 'line 1', '', 'line 2', '</pre>', '', 'after'].join('\n'))
    ).toBe(['<pre>', 'line 1', '', 'line 2', '</pre>', '', 'after'].join('\n'));
  });

  it('does not start fenced code state inside raw html blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['<pre>', '```', '', '```', '</pre>', '', 'after'].join('\n'))
    ).toBe(['<pre>', '```', '', '```', '</pre>', '', 'after'].join('\n'));
  });

  it('does not add placeholders inside blockquote raw html blocks', () => {
    const markdown = ['> <pre>', '>', '> </pre>'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not add placeholders inside markdown html comments', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['<!--', 'note', '', 'comment', '-->', '', 'after'].join('\n'))
    ).toBe(['<!--', 'note', '', 'comment', '-->', '', 'after'].join('\n'));
  });

  it('does not add placeholders around block alignment comments', () => {
    const markdown = ['Paragraph', '', '<!--align:center-->', '', '# Heading'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not add placeholders inside lowercase html declarations', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['<!doctype', '', 'html>', '', 'after'].join('\n'))
    ).toBe(['<!doctype', '', 'html>', '', 'after'].join('\n'));
  });

  it('keeps structural blank lines after one-line html blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['<?note value?>', '', '<!doctype html>', '', 'after'].join('\n'))
    ).toBe(['<?note value?>', '', '<!doctype html>', '', 'after'].join('\n'));
  });

  it('round trips representative markdown through preserve and normalize', () => {
    const markdown = [
      '# Heading',
      '',
      'Paragraph with **strong** and [link](https://example.com).',
      '',
      '> Quote',
      '>',
      '> - [ ] task',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '```ts',
      'const value = 1;',
      '',
      'console.log(value);',
      '```',
      '',
      '<pre>',
      '',
      '</pre>',
      '',
      '    code line 1',
      '',
      '    code line 2',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });
});
