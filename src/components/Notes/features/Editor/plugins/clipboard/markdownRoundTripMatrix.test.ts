import { describe, it } from 'vitest';
import { expectStableMarkdownRoundTrip } from './markdownRoundTripTestUtils';

describe('markdown syntax persistence matrix', () => {
  it.each([
    {
      name: 'yaml frontmatter',
      markdown: ['---', 'title: Demo', 'tags:', '  - one', '---', '# Heading'].join('\n'),
    },
    {
      name: 'frontmatter with hidden app metadata',
      markdown: [
        '---',
        'title: Demo',
        'vlaina_cover: "@biva/1"',
        '---',
        '# Heading',
      ].join('\n'),
      expected: [
        '---',
        'title: Demo',
        '',
        'vlaina_cover: "@biva/1"',
        '---',
        '# Heading',
      ].join('\n'),
    },
    {
      name: 'math block and inline math',
      markdown: ['Inline math $x + y$.', '', '$$', '\\frac{1}{2}', '$$'].join('\n'),
    },
    {
      name: 'math block with blank lines',
      markdown: ['Before math.', '', '$$', 'a = b', '', 'c = d', '$$', '', 'After math.'].join('\n'),
    },
    {
      name: 'callout blockquote',
      markdown: ['> 💡 Callout title', '>', '> Callout body'].join('\n'),
    },
    {
      name: 'callout with nested list and code',
      markdown: [
        '> 💡 Callout title',
        '>',
        '> - First item',
        '> - Second item',
        '>',
        '> ```ts',
        '> const value = 1;',
        '> ```',
      ].join('\n'),
      expected: [
        '> 💡 Callout title',
        '>',
        '> - First item',
        '>',
        '> - Second item',
        '>',
        '> ```ts',
        '> const value = 1;',
        '> ```',
      ].join('\n'),
    },
    {
      name: 'footnotes',
      markdown: ['Footnote ref[^1].', '', '[^1]: Footnote body'].join('\n'),
    },
    {
      name: 'footnote with nested paragraph and list',
      markdown: [
        'Footnote ref[^note].',
        '',
        '[^note]: First paragraph.',
        '',
        '    Second paragraph.',
        '',
        '    - Nested item',
      ].join('\n'),
    },
    {
      name: 'frontmatter followed by paragraph without extra blank line',
      markdown: ['---', 'title: Demo', '---', 'Body text.'].join('\n'),
    },
    {
      name: 'highlight superscript and subscript',
      markdown: 'Use ==highlight==, <sup>up</sup>, and <sub>down</sub>.',
    },
    {
      name: 'escaped html text inside custom inline marks',
      markdown: [
        '<sup>a &lt; b &amp; c</sup>',
        '<sub>x &gt; y</sub>',
        '<span style="color: #123456">red &lt; blue</span>',
        '<mark style="background-color: #ecf6ff">marked &amp; safe</mark>',
      ].join(' '),
      expectedText: 'a < b & c x > y red < blue marked & safe',
    },
    {
      name: 'custom inline color html with mixed css declarations',
      markdown: [
        '<span class="x" style="font-weight: 600; color: #123456">red &lt; blue</span>',
        '<mark data-bg-color="#ecf6ff" style="border-radius: 2px; background-color: #ecf6ff">marked &amp; safe</mark>',
      ].join(' '),
      expected: [
        '<span style="color: #123456">red &lt; blue</span>',
        '<mark style="background-color: #ecf6ff">marked &amp; safe</mark>',
      ].join(' '),
      expectedText: 'red < blue marked & safe',
    },
    {
      name: 'custom inline color html with css case and markdown punctuation',
      markdown: [
        '<span style="font-weight: 600; COLOR: #123456">Use *literal* [text] &quot;quote&quot;</span>',
        '<mark style="BACKGROUND-COLOR: #ecf6ff">a * b &amp; c</mark>',
      ].join(' '),
      expected: [
        '<span style="font-weight: 600; COLOR: #123456">Use *literal* \\[text] "quote"</span>',
        '<mark style="background-color: #ecf6ff">a * b &amp; c</mark>',
      ].join(' '),
      expectedText: 'Use literal [text] "quote" a * b & c',
    },
    {
      name: 'unsupported inline span html stays standard markdown html',
      markdown: '<span data-note="keep">plain &lt; text</span>',
      expectedText: 'plain < text',
    },
    {
      name: 'underline syntax',
      markdown: 'Use ++underlined text++ here.',
    },
    {
      name: 'delimiter-sensitive highlight and underline text',
      markdown: '<mark>a = b &lt; c</mark> <u>x + y &amp; z</u>',
      expected: '<mark>a = b &lt; c</mark> <u>x + y &amp; z</u>',
      expectedText: 'a = b < c x + y & z',
    },
    {
      name: 'mermaid diagram',
      markdown: ['```mermaid', 'graph TD', '  A --> B', '```'].join('\n'),
    },
    {
      name: 'mermaid diagram with blank line',
      markdown: ['```mermaid', 'graph TD', '', '  A --> B', '```'].join('\n'),
    },
    {
      name: 'mermaid flow fence alias',
      markdown: ['```flow', 'flowchart TD', '  A --> B', '```'].join('\n'),
      expected: ['```mermaid', 'flowchart TD', '  A --> B', '```'].join('\n'),
    },
    {
      name: 'mermaid detector fence alias',
      markdown: ['```packet-beta', '0-7: "Source"', '```'].join('\n'),
      expected: ['```mermaid', '0-7: "Source"', '```'].join('\n'),
    },
    {
      name: 'code block language alias',
      markdown: ['```JS', 'const value = 1;', '```'].join('\n'),
      expected: ['```ecmascript', 'const value = 1;', '```'].join('\n'),
    },
    {
      name: 'video image syntax',
      markdown: '![video](https://example.com/video.mp4 "Demo video")',
    },
    {
      name: 'markdown image attrs with escaped text',
      markdown: '![A < B](image.png?a=1&b=2 "Title & More")',
      expected: '![A < B](image.png?a=1\\&b=2 "Title & More")',
      expectedText: 'A < BTitle & More',
    },
    {
      name: 'html image attrs with escaped text',
      markdown: '<img src="image.png?a=1&amp;b=2" alt="A &lt; B" width="40%" align="right" title="Title &amp; More" />',
      expected: '<img src="image.png?a=1&amp;b=2" alt="A &lt; B" width="40%" align="right" title="Title &amp; More" />',
      expectedText: 'A < B',
    },
    {
      name: 'html image single-quoted attrs and escaped quotes',
      markdown: '<img src=\'image one.png?a=1&amp;b=2\' alt=\'A &quot;quote&quot;\' width=\'50%\' align=\'left\' title=\'Title &#39;One&#39;\' />',
      expected: '<img src="image one.png?a=1&amp;b=2" alt="A &quot;quote&quot;" width="50%" align="left" title="Title &#39;One&#39;" />',
      expectedText: 'A "quote"',
    },
    {
      name: 'table of contents marker',
      markdown: ['[TOC]', '', '# Heading'].join('\n'),
    },
    {
      name: 'block alignment comments',
      markdown: ['Paragraph', '<!--align:center-->', '', '# Heading', '<!--align:right-->'].join('\n'),
      expected: [
        'Paragraph',
        '',
        '<!--align:center-->',
        '',
        '# Heading',
        '',
        '<!--align:right-->',
      ].join('\n'),
    },
  ])('keeps custom syntax stable and clean on reopen: $name', async ({ markdown, expected, expectedText }) => {
    await expectStableMarkdownRoundTrip(markdown, expected, expectedText);
  });
});
