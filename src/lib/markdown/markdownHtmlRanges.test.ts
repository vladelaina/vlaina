import { describe, expect, it } from 'vitest';

import { getRawTextHtmlRanges, getSanitizerDroppedRawHtmlRanges } from './markdownHtmlRanges';

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
});
