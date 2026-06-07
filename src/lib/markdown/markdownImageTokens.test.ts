import { describe, expect, it } from 'vitest';
import {
  parseHtmlImageTokens,
  parseMarkdownAndHtmlImageTokens,
  parseMarkdownImageTokens,
  stripMarkdownImageTokens,
} from './markdownImageTokens';

function parseSeparateImageTokens(markdown: string) {
  return [
    ...parseMarkdownImageTokens(markdown),
    ...parseHtmlImageTokens(markdown),
  ].sort((a, b) => a.start - b.start);
}

describe('markdownImageTokens', () => {
  it('parses combined markdown and html image tokens like the separate parsers', () => {
    const markdown = [
      'Intro ![markdown](https://example.com/a.png)',
      '<img src="https://example.com/b.png" alt="b">',
      '`![code](https://example.com/code.png)`',
      '<!-- <img src="https://example.com/comment.png"> -->',
      '```md',
      '![fenced](https://example.com/fenced.png)',
      '```',
      '<p><img src="https://example.com/block.png"></p>',
      'Tail ![nested [label]](<https://example.com/c.png>)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown)).toEqual(parseSeparateImageTokens(markdown));
  });

  it('ignores markdown and html image syntax inside raw pre blocks', () => {
    const markdown = [
      '<pre>',
      '![example](https://example.com/code.png)',
      '<img src="https://example.com/code-html.png">',
      '</pre>',
      '',
      '![real](https://example.com/real.png)',
      '<img src="https://example.com/real-html.png">',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
      'https://example.com/real-html.png',
    ]);
  });

  it('ignores image syntax inside raw html tags whose contents are dropped by sanitizers', () => {
    const markdown = [
      '<svg><image href="https://example.com/svg.png"></image></svg>',
      '<noscript><img src="https://example.com/noscript.png"></noscript>',
      '<noembed>![embed](https://example.com/noembed.png)</noembed>',
      '<noframes><img src="https://example.com/noframes.png"></noframes>',
      '<math><img src="https://example.com/math.png"></math>',
      '',
      '![real](https://example.com/real.png)',
      '<img src="https://example.com/real-html.png">',
      '<plaintext><img src="https://example.com/plaintext.png"></plaintext>',
      '![hidden](https://example.com/after-plaintext.png)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
      'https://example.com/real-html.png',
    ]);
  });

  it('ignores markdown image syntax inside source GFM HTML blocks', () => {
    const markdown = [
      '<source srcset="https://example.com/source.webp 1x">',
      '![hidden](https://example.com/hidden.png)',
      '',
      '![real](https://example.com/real.png)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
    ]);
  });

  it('ignores markdown image syntax inside GFM type-7 HTML blocks', () => {
    const markdown = [
      '<custom-element>',
      '![hidden](https://example.com/hidden.png)',
      '</custom-element>',
      '',
      '![real](https://example.com/real.png)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
    ]);
  });

  it('ignores markdown image syntax inside blockquote GFM type-7 HTML blocks', () => {
    const markdown = [
      '> <custom-element>',
      '> ![hidden](https://example.com/hidden.png)',
      '> </custom-element>',
      '>',
      '![real](https://example.com/real.png)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
    ]);
  });

  it('ignores markdown image syntax inside non-tag GFM HTML blocks', () => {
    const markdown = [
      '<![CDATA[',
      '![hidden-cdata](https://example.com/hidden-cdata.png)',
      ']]>',
      '<?process ![hidden-processing](https://example.com/hidden-processing.png) ?>',
      '<!DOCTYPE ![hidden-declaration](https://example.com/hidden-declaration.png)>',
      '![real](https://example.com/real.png)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
    ]);
  });

  it('keeps nested dropped raw html containers protected until the matching close', () => {
    const markdown = [
      '<svg>',
      '<svg><img src="https://example.com/hidden-one.png"></svg>',
      '<img src="https://example.com/hidden-two.png">',
      '</svg>',
      '<img src="https://example.com/real-html.png">',
      '<math><math>![hidden](https://example.com/hidden-three.png)</math>![hidden](https://example.com/hidden-four.png)</math>',
      '![real](https://example.com/real.png)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real-html.png',
      'https://example.com/real.png',
    ]);
  });

  it('keeps image extraction correct after many ignored inline ranges', () => {
    const ignoredImages = Array.from(
      { length: 1500 },
      (_, index) => `\`![ignored ${index}](https://example.com/ignored-${index}.png)\``,
    );
    const markdown = [
      ...ignoredImages,
      '![real](https://example.com/real.png)',
      '<img src="https://example.com/real-html.png">',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
      'https://example.com/real-html.png',
    ]);
  });

  it('supports bounded combined image token parsing when requested', () => {
    const markdown = [
      '![one](https://example.com/one.png)',
      '<img src="https://example.com/two.png">',
      '![three](https://example.com/three.png)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown, { maxTokens: 2 }).map((token) => token.src)).toEqual([
      'https://example.com/one.png',
      'https://example.com/two.png',
    ]);
    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toHaveLength(3);
  });

  it('returns early for long text without image markers', () => {
    const markdown = 'plain text without images\n'.repeat(10_000);

    expect(parseMarkdownImageTokens(markdown)).toEqual([]);
    expect(parseHtmlImageTokens(markdown)).toEqual([]);
    expect(parseMarkdownAndHtmlImageTokens(markdown)).toEqual([]);
  });

  it('treats non-finite token bounds as zero except infinity', () => {
    const markdown = [
      '![one](https://example.com/one.png)',
      '<img src="https://example.com/two.png">',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown, { maxTokens: Number.NaN })).toEqual([]);
    expect(parseMarkdownAndHtmlImageTokens(markdown, { maxTokens: Number.NEGATIVE_INFINITY })).toEqual([]);
    expect(parseMarkdownAndHtmlImageTokens(markdown, { maxTokens: Number.POSITIVE_INFINITY })).toHaveLength(2);
  });

  it('bounds default markdown image token stripping', () => {
    const markdown = Array.from({ length: 2001 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    }).join('\n');

    const stripped = stripMarkdownImageTokens(markdown);

    expect(stripped).toContain('![image 2000](https://example.com/2000.png)');
    expect(stripped.match(/!\[image/g)).toHaveLength(1);
  });

  it('keeps bounded html image parsing from reading markdown image targets as html', () => {
    const markdown = [
      '![one](<https://example.com/<img src="https://example.com/not-html-1.png">>)',
      '![two](<https://example.com/<img src="https://example.com/not-html-2.png">>)',
      '<img src="https://example.com/real.png">',
    ].join('\n');

    expect(parseHtmlImageTokens(markdown, { maxTokens: 1 }).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
    ]);
  });

  it('does not spend the html tag scan budget on tags inside comments', () => {
    const ignoredCommentTags = Array.from(
      { length: 4000 },
      (_, index) => `<img src="https://example.com/comment-${index}.png">`,
    ).join('');
    const markdown = [
      `<!-- ${ignoredCommentTags} -->`,
      '<img src="https://example.com/real.png">',
    ].join('\n');

    expect(parseHtmlImageTokens(markdown, { maxTokens: 1 }).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
    ]);
  });

  it('does not spend the html tag scan budget on tags inside inline code', () => {
    const ignoredInlineTags = Array.from(
      { length: 4000 },
      (_, index) => `\`<span data-example="${index}"></span>\``,
    );
    const markdown = [
      ...ignoredInlineTags,
      '<img src="https://example.com/real.png">',
    ].join('\n');

    expect(parseHtmlImageTokens(markdown, { maxTokens: 1 }).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
    ]);
  });

  it('does not keep scanning html after bounded markdown target protection is exhausted', () => {
    const markdown = [
      ...Array.from(
        { length: 2500 },
        (_, index) => `![image ${index}](<https://example.com/<img src="https://example.com/not-html-${index}.png"\\>>)`,
      ),
      '<img src="https://example.com/real.png">',
    ].join('\n');

    expect(parseHtmlImageTokens(markdown, { maxTokens: 1 })).toEqual([]);
  });

  it('rejects oversized ordinary html image attributes before decoding src values', () => {
    expect(parseHtmlImageTokens(`<img src="https://example.com/${'a'.repeat(16 * 1024)}.png">`)).toEqual([]);
    expect(parseHtmlImageTokens(`<img alt="${'a'.repeat(16 * 1024 + 1)}" src="https://example.com/a.png">`)).toEqual([]);
  });

  it('keeps large html data image src values for downstream image policy checks', () => {
    const dataSrc = `data:image/png;base64,${'A'.repeat(70 * 1024)}`;

    expect(parseHtmlImageTokens(`<img src="${dataSrc}">`).map((token) => token.src)).toEqual([dataSrc]);
  });

  it('does not treat plain angle-bracket text as an HTML tag range', () => {
    const markdown = '< not html ![real](https://example.com/real.png) >';

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
    ]);
  });

  it('keeps raw HTML protection after invalid angle-bracket text', () => {
    const markdown = [
      '< not an html tag',
      '<pre>',
      '![hidden](https://example.com/hidden.png)',
      '</pre>',
      '![real](https://example.com/real.png)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
    ]);
  });
});
