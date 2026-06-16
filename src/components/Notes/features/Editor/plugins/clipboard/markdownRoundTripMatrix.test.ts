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
      name: 'leading yaml-frontmatter code fence',
      markdown: ['```yaml-frontmatter', 'title: Demo', '```', '# Heading'].join('\n'),
      expected: ['```yaml-frontmatter', 'title: Demo', '```', '', '# Heading'].join('\n'),
    },
    {
      name: 'math block and inline math',
      markdown: ['Inline math $x + y$.', '', '$$', '\\frac{1}{2}', '$$'].join('\n'),
    },
    {
      name: 'standard bracket display math',
      markdown: ['Before math.', '', '\\[', 'f=\\mu mg', '\\]', '', 'After math.'].join('\n'),
    },
    {
      name: 'generated bracket-backslash display math',
      markdown: ['摩擦力大小为', '', '[\\', 'f=\\mu mg\\', ']', '', '故 A 在传送带上的加速度大小为'].join('\n'),
      expected: ['摩擦力大小为', '', '\\[', 'f=\\mu mg', '\\]', '', '故 A 在传送带上的加速度大小为'].join('\n'),
    },
    {
      name: 'generated bracket-only display math',
      markdown: ['摩擦力大小为', '', '[', 'f=\\mu mg', ']', '', '故 A 在传送带上的加速度大小为'].join('\n'),
      expected: ['摩擦力大小为', '', '\\[', 'f=\\mu mg', '\\]', '', '故 A 在传送带上的加速度大小为'].join('\n'),
    },
    {
      name: 'generated bracket-backslash display math with inline closer',
      markdown: ['摩擦力大小为', '', '[\\', 'a=\\frac{f}{m}=\\mu g]', '', '故 A 在传送带上的加速度大小为'].join('\n'),
      expected: ['摩擦力大小为', '', '\\[', 'a=\\frac{f}{m}=\\mu g', '\\]', '', '故 A 在传送带上的加速度大小为'].join('\n'),
    },
    {
      name: 'escaped bracket display math with trailing opener backslash',
      markdown: ['摩擦力大小为', '', '\\[\\', 'f=\\mu mg\\', ']', '', '\\\\[\\', 'a=\\frac{f}{m}=\\mu g\\', ']', '', '故 A 在传送带上的加速度大小为'].join('\n'),
      expected: ['摩擦力大小为', '', '\\[', 'f=\\mu mg', '\\]', '', '\\[', 'a=\\frac{f}{m}=\\mu g', '\\]', '', '故 A 在传送带上的加速度大小为'].join('\n'),
    },
    {
      name: 'math block with blank lines',
      markdown: ['Before math.', '', '$$', 'a = b', '', 'c = d', '$$', '', 'After math.'].join('\n'),
    },
    {
      name: 'advanced math structures and chemistry syntax',
      markdown: [
        '$$',
        '\\begin{align}a&=b\\\\c&=d\\end{align}',
        '$$',
        '',
        '$$',
        '\\begin{gather}x=y\\\\u=v\\end{gather}',
        '$$',
        '',
        'Chemistry $\\ce{H2O}$ and units $\\pu{123 kJ mol-1}$.',
      ].join('\n'),
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
      markdown: 'Use ==highlight==, X^2^, and H~2~O.',
    },
    {
      name: 'escaped custom inline mark delimiters',
      markdown: 'Use \\==literal==, X\\^2^, H\\~2~O, and \\++under++.',
      expected: 'Use \\==literal==, X\\^2^, H\\~2\\~O, and \\++under++.',
    },
    {
      name: 'html superscript and subscript serialize to markdown syntax',
      markdown: 'Use <sup>up</sup>, and <sub>down</sub>.',
      expected: 'Use ^up^, and ~down~.',
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
        '<span style="color: #123456">Use </span>*<span style="color: #123456">literal</span>*<span style="color: #123456"> [text] "quote"</span>',
        '<mark style="background-color: #ecf6ff">a * b &amp; c</mark>',
      ].join(' '),
      expectedText: 'Use literal [text] "quote" a * b & c',
    },
    {
      name: 'custom inline color html with nested inline markdown',
      markdown: '<span style="color : #123456"><em>nested</em></span> <mark style="background-color : #ecf6ff"><strong>bold</strong></mark>',
      expected: '<span style="color: #123456"><em>nested</em></span> <mark style="background-color: #ecf6ff"><strong>bold</strong></mark>',
      expectedText: 'nested bold',
    },
    {
      name: 'custom inline color html around markdown links remains stable',
      markdown: '<span style="color : #123456">[Docs](https://example.com)</span> <mark style="background-color : #ecf6ff">[Safe](docs/safe.md)</mark>',
      expected: '[<span style="color: #123456">Docs</span>](https://example.com) [<mark style="background-color: #ecf6ff">Safe</mark>](docs/safe.md)',
      expectedText: 'Docs Safe',
    },
    {
      name: 'custom inline html marks preserve nested markdown emphasis',
      markdown: '<u>*under*</u> <sup>**up**</sup> <sub>[down](docs/down.md)</sub>',
      expected: '*++under++* **^up^** [~down~](docs/down.md)',
      expectedText: 'under up down',
    },
    {
      name: 'unsupported inline span html stays standard markdown html',
      markdown: '<span data-note="keep">plain &lt; text</span>',
      expected: '<span>plain &lt; text</span>',
      expectedText: 'plain < text',
    },
    {
      name: 'plain unclosed html-like paragraph text',
      markdown: '<p>',
      expectedText: '<p>',
    },
    {
      name: 'plain closing html-like paragraph text',
      markdown: '</p>',
      expectedText: '</p>',
    },
    {
      name: 'plain unclosed html-like text with trailing content',
      markdown: '<div>literal',
      expectedText: '<div>literal',
    },
    {
      name: 'plain empty inline html-like text',
      markdown: '<a></a>',
      expectedText: '<a></a>',
    },
    {
      name: 'plain empty block html-like text',
      markdown: '<p></p>',
      expectedText: '<p></p>',
    },
    {
      name: 'raw html block with content',
      markdown: '<div>raw</div>',
      expectedText: 'raw',
    },
    {
      name: 'raw empty html with attributes',
      markdown: '<a href="#anchor"></a>',
      expectedText: '',
    },
    {
      name: 'raw inline keyboard html',
      markdown: '<kbd>Ctrl</kbd>',
      expectedText: 'Ctrl',
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
      name: 'html-sensitive highlight and underline text',
      markdown: '<mark>a &lt; b &amp; c</mark> <u>x &lt; y &amp; z</u>',
      expected: '<mark>a &lt; b &amp; c</mark> <u>x &lt; y &amp; z</u>',
      expectedText: 'a < b & c x < y & z',
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
      name: 'mermaid flow fence alias without directive',
      markdown: ['```flow', 'A --> B', '```'].join('\n'),
      expected: ['```mermaid', 'flowchart TD', 'A --> B', '```'].join('\n'),
    },
    {
      name: 'mermaid flowchart-v2 fence alias without directive',
      markdown: ['```flowchart-v2', 'A --> B', '```'].join('\n'),
      expected: ['```mermaid', 'flowchart TD', 'A --> B', '```'].join('\n'),
    },
    {
      name: 'mermaid flow alias with frontmatter before missing directive',
      markdown: ['```flow', '---', 'title: Flow', '---', 'A --> B', '```'].join('\n'),
      expected: [
        '```mermaid',
        '---',
        'title: Flow',
        '---',
        'flowchart TD',
        'A --> B',
        '```',
      ].join('\n'),
    },
    {
      name: 'mermaid flow fence alias with direction',
      markdown: ['```mermaid', 'flow LR', 'A --> B', '```'].join('\n'),
      expected: ['```mermaid', 'flowchart LR', 'A --> B', '```'].join('\n'),
    },
    {
      name: 'mermaid sequence fence alias',
      markdown: ['```sequence', 'Alice->Bob: Hello', '```'].join('\n'),
      expected: ['```mermaid', 'sequenceDiagram', 'Alice->Bob: Hello', '```'].join('\n'),
    },
    {
      name: 'mermaid init directive before short sequence alias',
      markdown: [
        '```mermaid',
        '%%{init: {"theme": "default"}}%%',
        'sequence',
        'Alice->Bob: Hello',
        '```',
      ].join('\n'),
      expected: [
        '```mermaid',
        '%%{init: {"theme": "default"}}%%',
        'sequenceDiagram',
        'Alice->Bob: Hello',
        '```',
      ].join('\n'),
    },
    {
      name: 'mermaid comment before short flow alias',
      markdown: [
        '```mermaid',
        '%% keep this comment',
        'flow',
        'A --> B',
        '```',
      ].join('\n'),
      expected: [
        '```mermaid',
        '%% keep this comment',
        'flowchart TD',
        'A --> B',
        '```',
      ].join('\n'),
    },
    {
      name: 'mermaid zenuml fence alias',
      markdown: [
        '```zenuml',
        'title Declare participant',
        'Bob',
        'Alice',
        'Alice->Bob: Hi Bob',
        '```',
      ].join('\n'),
      expected: [
        '```mermaid',
        'zenuml',
        'title Declare participant',
        'Bob',
        'Alice',
        'Alice->Bob: Hi Bob',
        '```',
      ].join('\n'),
    },
    {
      name: 'mermaid detector fence alias',
      markdown: ['```packet-beta', '0-7: "Source"', '```'].join('\n'),
      expected: ['```mermaid', 'packet-beta', '0-7: "Source"', '```'].join('\n'),
    },
    {
      name: 'code block language alias',
      markdown: ['```JS', 'const value = 1;', '```'].join('\n'),
      expected: ['```ecmascript', 'const value = 1;', '```'].join('\n'),
    },
    {
      name: 'video image syntax',
      markdown: '![video](https://example.com/video.mp4 "Demo video")',
      expected: '![video](https://example.com/video.mp4 "Demo video")',
    },
    {
      name: 'markdown image attrs with escaped text',
      markdown: '![A < B](image.png?a=1&b=2 "Title & More")',
      expected: '<img src="image.png?a=1&amp;b=2" alt="A &lt; B" title="Title &amp; More" />',
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
      name: 'escaped table of contents marker',
      markdown: ['\\[TOC]', '', '# Heading'].join('\n'),
    },
    {
      name: 'definition list',
      markdown: ['Term', '', ': Definition'].join('\n'),
    },
    {
      name: 'escaped definition list marker',
      markdown: ['Term', '', '\\: Definition'].join('\n'),
    },
    {
      name: 'abbreviation definition and usage',
      markdown: ['*[HTML]: HyperText Markup Language', '', 'HTML demo'].join('\n'),
      expectedText: 'HTML demo',
    },
    {
      name: 'abbreviation definition preserves punctuation-heavy usage',
      markdown: ['*[C++]: C Plus Plus', '', 'C++ demo and C+++ suffix'].join('\n'),
      expectedText: 'C++ demo and C+++ suffix',
    },
    {
      name: 'escaped abbreviation definition',
      markdown: ['\\*[HTML]: HyperText Markup Language', '', 'HTML demo'].join('\n'),
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
