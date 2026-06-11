import { describe, expect, it } from 'vitest';

import {
  collectHtmlTagRanges,
  getHtmlTagRanges,
  getRawTextHtmlRanges,
  getSanitizerDroppedRawHtmlRanges,
  MAX_HTML_TAG_END_SCAN_CHARS,
} from './markdownHtmlRanges';

describe('markdownHtmlRanges', () => {
  it('does not treat raw-text tag names inside ordinary HTML attributes as containers', () => {
    const markdown = '<span data-example="<svg>"></span>\n![real](img:real.png)';

    expect(getRawTextHtmlRanges(markdown, { start: 0, end: markdown.length })).toEqual([]);
  });

  it('keeps nested raw-text HTML containers protected until the matching outer close tag', () => {
    const markdown = [
      '<svg>',
      '<svg><img src="hidden-one.png"></svg>',
      '<img src="hidden-two.png">',
      '</svg>',
      '<img src="real.png">',
    ].join('\n');

    const ranges = getRawTextHtmlRanges(markdown, { start: 0, end: markdown.length });

    const outerCloseEnd = markdown.lastIndexOf('</svg>') + '</svg>'.length;
    expect(ranges).toEqual([{ start: 0, end: outerCloseEnd }]);
  });

  it('keeps blockquote raw-text HTML containers protected until the matching close tag', () => {
    const markdown = [
      '> <svg>',
      '> <text>hidden</text>',
      '> </svg>',
      'visible',
    ].join('\n');

    const ranges = getSanitizerDroppedRawHtmlRanges(markdown, { start: 0, end: markdown.length });

    const svgStart = markdown.indexOf('<svg>');
    const svgEnd = markdown.indexOf('</svg>') + '</svg>'.length;
    expect(ranges).toEqual([{ start: svgStart, end: svgEnd }]);
  });

  it('ignores raw-text close tags inside HTML comments', () => {
    const markdown = [
      '<svg>',
      '<!-- </svg> -->',
      '<img src="hidden.png">',
      '</svg>',
      '<img src="real.png">',
    ].join('\n');

    const ranges = getRawTextHtmlRanges(markdown, { start: 0, end: markdown.length });

    const outerCloseEnd = markdown.lastIndexOf('</svg>') + '</svg>'.length;
    expect(ranges).toEqual([{ start: 0, end: outerCloseEnd }]);
  });

  it('ignores raw-text close tags inside HTML declarations and CDATA', () => {
    const markdown = [
      '<svg>',
      '<!bogus </svg>>',
      '<![CDATA[</svg>]]>',
      '<img src="hidden.png">',
      '</svg>',
      '<img src="real.png">',
    ].join('\n');

    const ranges = getRawTextHtmlRanges(markdown, { start: 0, end: markdown.length });

    const outerCloseEnd = markdown.lastIndexOf('</svg>') + '</svg>'.length;
    expect(ranges).toEqual([{ start: 0, end: outerCloseEnd }]);
  });

  it('reports only sanitizer-dropped raw HTML containers for visible-content scans', () => {
    const markdown = [
      '<script>escaped but visible source</script>',
      '<svg>',
      'hidden text',
      '</svg>',
      '<pre>visible preformatted text</pre>',
      '<math>hidden math</math>',
    ].join('\n');

    const ranges = getSanitizerDroppedRawHtmlRanges(markdown, { start: 0, end: markdown.length });

    const svgStart = markdown.indexOf('<svg>');
    const svgEnd = markdown.indexOf('</svg>') + '</svg>'.length;
    const mathStart = markdown.indexOf('<math>');
    const mathEnd = markdown.indexOf('</math>') + '</math>'.length;
    expect(ranges).toEqual([
      { start: svgStart, end: svgEnd },
      { start: mathStart, end: mathEnd },
    ]);
  });

  it('protects overlong HTML tags without returning them as parseable tag ranges', () => {
    const badLine = `<span data-value="![hidden](img:hidden.png) ${'a'.repeat(MAX_HTML_TAG_END_SCAN_CHARS)}`;
    const realTag = '<img src="real.png">';
    const markdown = `${badLine}\n${realTag}`;
    const scan = collectHtmlTagRanges(markdown, { start: 0, end: markdown.length });

    expect(scan.protectedRanges).toEqual([{ start: 0, end: badLine.length }]);
    expect(scan.ranges).toEqual([{ start: badLine.length + 1, end: markdown.length }]);
    expect(getHtmlTagRanges(markdown, { start: 0, end: markdown.length })).toEqual(scan.ranges);
  });

  it('line-bounds overlong raw-text HTML openers', () => {
    const badLine = `<svg data-value="![hidden](img:hidden.png) ${'a'.repeat(MAX_HTML_TAG_END_SCAN_CHARS)}`;
    const markdown = `${badLine}\n![real](img:real.png)`;

    expect(getRawTextHtmlRanges(markdown, { start: 0, end: markdown.length })).toEqual([
      { start: 0, end: badLine.length },
    ]);
  });

  it('keeps raw-text container closing after an overlong nested malformed tag', () => {
    const badLine = `<span data-value="${'a'.repeat(MAX_HTML_TAG_END_SCAN_CHARS)}`;
    const markdown = [
      '<svg>',
      badLine,
      '</svg>',
      '![real](img:real.png)',
    ].join('\n');

    const ranges = getRawTextHtmlRanges(markdown, { start: 0, end: markdown.length });
    const outerCloseEnd = markdown.indexOf('</svg>') + '</svg>'.length;

    expect(ranges).toEqual([{ start: 0, end: outerCloseEnd }]);
  });
});
