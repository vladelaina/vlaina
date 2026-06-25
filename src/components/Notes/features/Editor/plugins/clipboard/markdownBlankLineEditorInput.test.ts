import { describe, expect, it } from 'vitest';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
  preserveMarkdownBlankLinesForPaste,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  getFrontmatterFenceLanguage,
  getFrontmatterFenceMeta,
} from '../frontmatter/frontmatterMarkdown';

const LEGACY_EMPTY_LINE_PLACEHOLDER = '\u200B';
const MARKDOWN_BLANK_LINE_PLACEHOLDER = '<!--vlaina-markdown-blank-line-->';
const RENDERED_HTML_BOUNDARY_PLACEHOLDER = '<!--vlaina-rendered-html-boundary-blank-line-->';
const NON_PERSISTED_BLOCK_BOUNDARY_PLACEHOLDER = '<!--vlaina-markdown-tight-heading-->';

describe('preserveMarkdownBlankLinesForEditor editor input', () => {
  it('uses editor-only blocks for ordinary markdown blank lines', () => {
    expect(preserveMarkdownBlankLinesForEditor('1\n\n2')).toBe(
      ['1', MARKDOWN_BLANK_LINE_PLACEHOLDER, '2'].join('\n')
    );
  });

  it('uses one editor-only block for each leading markdown blank line', () => {
    expect(preserveMarkdownBlankLinesForEditor(['', 'Top'].join('\n'))).toBe(
      [MARKDOWN_BLANK_LINE_PLACEHOLDER, 'Top'].join('\n')
    );
    expect(preserveMarkdownBlankLinesForEditor(['', '', 'Top', '', 'Body'].join('\n'))).toBe(
      [
        MARKDOWN_BLANK_LINE_PLACEHOLDER,
        MARKDOWN_BLANK_LINE_PLACEHOLDER,
        'Top',
        MARKDOWN_BLANK_LINE_PLACEHOLDER,
        'Body',
      ].join('\n')
    );
  });

  it('keeps single structural paste blank lines as markdown separators', () => {
    expect(preserveMarkdownBlankLinesForPaste(['# A', '', '# B'].join('\n'))).toBe(
      ['# A', '', '# B'].join('\n')
    );
    expect(preserveMarkdownBlankLinesForPaste(['# A', '## B', '### C'].join('\n'))).toBe(
      ['# A', '', '## B', '', '### C'].join('\n')
    );
    expect(preserveMarkdownBlankLinesForPaste(['Text', '', '$$', 'x', '$$'].join('\n'))).toBe(
      ['Text', '', '$$', 'x', '$$'].join('\n')
    );
  });

  it('keeps only extra paste blank lines as editor-only visible blank blocks', () => {
    expect(preserveMarkdownBlankLinesForPaste(['# A', '', '', '# B'].join('\n'))).toBe(
      ['# A', '', MARKDOWN_BLANK_LINE_PLACEHOLDER, '# B'].join('\n')
    );
  });

  it('uses editor-only blank line blocks after leading frontmatter', () => {
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

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe([
      '---',
      'vlaina_icon: "note"',
      'vlaina_updated: "2026-05-05T03:12:51.625Z"',
      '---',
      '1',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      '2',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      '3',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      '4',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
    ].join('\n'));
  });

  it('preserves long body blank line runs as editor-visible blank lines', () => {
    const blankLineCount = 200;
    const blankRun = Array.from({ length: blankLineCount }, () => '').join('\n');
    const markdown = ['before', blankRun, 'after'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput.split('\n').filter((line) => line === MARKDOWN_BLANK_LINE_PLACEHOLDER))
      .toHaveLength(blankLineCount);
    expect(editorInput).toContain('before');
    expect(editorInput).toContain('after');
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('does not cap long blank line runs inside fenced code blocks', () => {
    const blankRun = Array.from({ length: 20 }, () => '').join('\n');
    const markdown = ['```', 'before', blankRun, 'after', '```'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not inject editor blank-line comments inside display math blocks', () => {
    const dollarMath = ['$$', '', 'hi', '', '$$'].join('\n');
    const bracketMath = ['\\[', '', 'x^2', '', '\\]'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(dollarMath)).toBe(dollarMath);
    expect(preserveMarkdownBlankLinesForEditor(bracketMath)).toBe(bracketMath);
  });

  it('keeps editor blank-line comments outside adjacent display math blocks', () => {
    const markdown = ['$$', 'hi', '$$', '', '$$', 'bye', '$$'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe([
      '$$',
      'hi',
      '$$',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      '$$',
      'bye',
      '$$',
    ].join('\n'));
  });

  it('handles long blank line runs inside indented code blocks within the default test timeout', () => {
    const blankRun = Array.from({ length: 8_000 }, () => '').join('\n');
    const markdown = ['    before', blankRun, '    after', '', 'body'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('does not expose internal user break markers in editor input', () => {
    expect(preserveMarkdownBlankLinesForEditor(['1', '<br />', '2'].join('\n'))).toBe(
      ['1\\', '2'].join('\n')
    );
  });

  it('expands terminal list item br tags into editor-reopenable hard breaks', () => {
    expect(preserveMarkdownBlankLinesForEditor('- 1<br />')).toBe(['- 1\\', '  <br />'].join('\n'));
    expect(preserveMarkdownBlankLinesForEditor('- [ ] 1<br />')).toBe(['- [ ] 1\\', '  <br />'].join('\n'));
    expect(preserveMarkdownBlankLinesForEditor('1. 1<br />')).toBe(['1. 1\\', '   <br />'].join('\n'));
    expect(preserveMarkdownBlankLinesForEditor('> - 1<br />')).toBe(['> - 1\\', '>   <br />'].join('\n'));
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

  it('escapes paragraph trailing backslashes even when the text contains inline markdown', () => {
    const markdown = '底线（-/=）方式（**不推荐**）：\\';

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(
      '底线（-/=）方式（**不推荐**）：\\\\\\'
    );
  });

  it('escapes a standalone line-start backslash as literal text instead of a hard break', () => {
    expect(preserveMarkdownBlankLinesForEditor(['\\', '下一行'].join('\n'))).toBe(
      ['\\\\', NON_PERSISTED_BLOCK_BOUNDARY_PLACEHOLDER, '下一行'].join('\n')
    );
    expect(preserveMarkdownBlankLinesForEditor(['', '\\', '下一行'].join('\n'))).toBe(
      [MARKDOWN_BLANK_LINE_PLACEHOLDER, '\\\\', NON_PERSISTED_BLOCK_BOUNDARY_PLACEHOLDER, '下一行'].join('\n')
    );
  });

  it('escapes paragraph trailing backslashes inside mixed markdown documents', () => {
    const markdown = [
      '# Heading',
      '',
      '底线（-/=）方式（**不推荐**）：\\',
      '',
      '- item\\',
    ].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe([
      '# Heading',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      '底线（-/=）方式（**不推荐**）：\\\\\\',
      '',
      '- item\\',
    ].join('\n'));
  });

  it('keeps structural markdown trailing backslashes as hard breaks', () => {
    const markdown = ['- item\\', '- next'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not add placeholders inside fenced code blocks', () => {
    const markdown = ['```ts', 'const a = 1;', '', 'const b = 2;', '```', '', 'after'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toContain(['```ts', 'const a = 1;', '', 'const b = 2;', '```'].join('\n'));
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('does not rewrite br-only lines inside fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['```html', '<br />', '```'].join('\n'))
    ).toBe(['```html', '<br />', '```'].join('\n'));
  });

  it('does not rewrite internal user break sentinel text inside fenced code blocks', () => {
    const markdown = ['```txt', '\u0000VLAINA_USER_BR_SENTINEL\u0000', '```'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not rewrite list-like gaps inside fenced code blocks', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['```md', '- one', '', '- two', '```'].join('\n'))
    ).toBe(['```md', '- one', '', '- two', '```'].join('\n'));
  });

  it('uses visible editor-only placeholders for markdown blank lines between list items', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['- one', '', '', '- two'].join('\n'))
    ).toBe(
      [
        '- one',
        '- \u2800',
        '- \u2800',
        '- two',
      ].join('\n')
    );
  });

  it('uses plain bullet placeholders for task-list blank lines', () => {
    expect(
      preserveMarkdownBlankLinesForEditor(['- [ ] one', '', '- [ ] two'].join('\n'))
    ).toBe(
      [
        '- [ ] one',
        '- \u2800',
        '- [ ] two',
      ].join('\n')
    );
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
    const opening = `\`\`\`${getFrontmatterFenceLanguage()} ${getFrontmatterFenceMeta()}`;
    const markdown = [opening, 'title: Demo', '', 'summary: Test', '```', '', '# Heading'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toContain([opening, 'title: Demo', '', 'summary: Test', '```'].join('\n'));
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('keeps the structural separator and uses editor-only blocks for extra blank lines after markdown images', () => {
    const markdown = ['![alt](image.png)', '', '', '', '# Next'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toBe([
      '![alt](image.png)',
      '',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      '# Next',
    ].join('\n'));
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('keeps the structural separator and uses editor-only blocks for extra blank lines after html image blocks', () => {
    const markdown = ['<img src="image.png" />', '', '', '', '# Next'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toBe([
      '<img src="image.png" />',
      '',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      '# Next',
    ].join('\n'));
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('keeps the structural separator after source html blocks', () => {
    const markdown = ['<source srcset="images/a.webp 1x">', '', '# Next'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toBe(markdown);
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('matches fenced code closers by marker and length', () => {
    const markdown = ['````', '```', '', 'code', '````', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('does not close a fenced code block with a content line that only starts with a fence', () => {
    const markdown = ['```', '```still code', '', '```', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('does not treat indented code as fenced code', () => {
    const markdown = ['    ```', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('does not add placeholders inside indented code blocks', () => {
    const markdown = ['    line 1', '', '    line 2', '', 'after'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toContain(['    line 1', '', '    line 2'].join('\n'));
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('does not add placeholders inside tab-indented code blocks', () => {
    const markdown = ['\tline 1', '', '\tline 2', '', 'after'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toContain(['\tline 1', '', '\tline 2'].join('\n'));
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('detects indented code blocks after paragraph breaks', () => {
    const markdown = ['before', '', '    line 1', '', '    line 2'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('keeps structural blank lines before fenced code blocks', () => {
    const markdown = ['before', '', '```ts', 'const value = 1;', '```'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('keeps structural blank lines before nested fenced code blocks', () => {
    const markdown = [
      '- item',
      '',
      '  detail',
      '',
      '  ```ts',
      '  const value = 1;',
      '  ```',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('keeps trailing document blank lines after indented text', () => {
    const markdown = ['    line', ''].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('does not rewrite placeholder-like text inside indented code blocks', () => {
    const markdown = [`    ${LEGACY_EMPTY_LINE_PLACEHOLDER}`, '', '    <br />', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('does not treat backtick fences with backticks in the info string as fenced code', () => {
    const markdown = ['``` invalid ` info', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('does not treat mixed backtick and tilde marker runs as fenced code', () => {
    const markdown = ['``~', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('does not add placeholders inside raw html blocks that allow blank lines', () => {
    const markdown = ['<pre>', 'line 1', '', 'line 2', '</pre>', '', 'after'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toContain(['<pre>', 'line 1', '', 'line 2', '</pre>'].join('\n'));
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('does not start fenced code state inside raw html blocks', () => {
    const markdown = ['<pre>', '```', '', '```', '</pre>', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('does not add placeholders inside blockquote raw html blocks', () => {
    const markdown = ['> <pre>', '>', '> </pre>'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe(markdown);
  });

  it('does not add placeholders inside markdown html comments', () => {
    const markdown = ['<!--', 'note', '', 'comment', '-->', '', 'after'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toContain(['<!--', 'note', '', 'comment', '-->'].join('\n'));
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('uses editor-only blank line blocks around block alignment comments', () => {
    const markdown = ['Paragraph', '', '<!--align:center-->', '', '# Heading'].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe([
      'Paragraph',
      '',
      '<!--align:center-->',
      '',
      '# Heading',
    ].join('\n'));
  });

  it('does not add placeholders inside lowercase html declarations', () => {
    const markdown = ['<!doctype', '', 'html>', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('keeps structural blank lines after one-line html blocks', () => {
    const markdown = ['<?note value?>', '', '<!doctype html>', '', 'after'].join('\n');

    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('uses an editor-only blank line block after rendered one-line html blocks', () => {
    const markdown = ['<p align="center">HTML</p>', '', 'after'].join('\n');
    const editorInput = preserveMarkdownBlankLinesForEditor(markdown);

    expect(editorInput).toBe([
      '<p align="center">HTML</p>',
      '',
      RENDERED_HTML_BOUNDARY_PLACEHOLDER,
      'after',
    ].join('\n'));
    expect(normalizeSerializedMarkdownDocument(editorInput)).toBe(markdown);
  });

  it('strips editor-only blank line comments next to one-line html blocks on save', () => {
    const markdown = [
      '<p align="center">HTML</p>',
      '',
      RENDERED_HTML_BOUNDARY_PLACEHOLDER,
      'after',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe([
      '<p align="center">HTML</p>',
      '',
      'after',
    ].join('\n'));
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
