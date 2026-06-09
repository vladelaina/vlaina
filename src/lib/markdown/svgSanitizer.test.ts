import { describe, expect, it } from 'vitest';
import {
  MAX_SVG_SANITIZE_MARKUP_CHARS,
  sanitizeSvgMarkup,
} from './svgSanitizer';

function renderSanitizedSvg(markup: string) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeSvgMarkup(markup);
  return template.content;
}

describe('svgSanitizer', () => {
  it('drops external SVG references with whitespace around url and href syntax', () => {
    const content = renderSanitizedSvg([
      '<svg xmlns="http://www.w3.org/2000/svg">',
      '<a href = "https://example.test/link"><text>link</text></a>',
      '<a href = "#local-link"><text>local link</text></a>',
      '<image href = "https://example.test/a.png" xlink:href = "https://example.test/b.png"></image>',
      '<rect filter = "url ( https://example.test/filter.svg#drop )" fill = "url ( #local-fill )"></rect>',
      '<text style="fill: url ( #local-fill ); stroke: url ( https://example.test/stroke.svg#x ); opacity: .8">safe</text>',
      '</svg>',
    ].join(''));

    const link = content.querySelector('a');
    const image = content.querySelector('image');
    const rect = content.querySelector('rect');
    const text = content.querySelector('text');

    expect(link?.getAttribute('href')).toBeNull();
    expect(content.querySelectorAll('a')[1]?.getAttribute('href')).toBe('#local-link');
    expect(image?.getAttribute('href')).toBeNull();
    expect(image?.getAttribute('xlink:href')).toBeNull();
    expect(rect?.getAttribute('filter')).toBeNull();
    expect(rect?.getAttribute('fill')).toBe('url ( #local-fill )');
    expect(text?.getAttribute('style') || '').not.toContain('example.test');
  });

  it('drops SVG markup that exceeds the sanitizer depth budget', () => {
    const markup = `${'<svg><g>'.repeat(210)}<image href="https://example.test/a.png"></image>${'</g></svg>'.repeat(210)}`;

    expect(() => sanitizeSvgMarkup(markup)).not.toThrow();
    expect(sanitizeSvgMarkup(markup)).toBe('');
  });

  it('drops SVG markup that exceeds the sanitizer node budget', () => {
    const markup = [
      '<svg xmlns="http://www.w3.org/2000/svg">',
      Array.from({ length: 20_050 }, (_, index) => `<image href="https://example.test/${index}.png"></image>`).join(''),
      '</svg>',
    ].join('');

    expect(sanitizeSvgMarkup(markup)).toBe('');
  });

  it('drops oversized SVG markup before DOM sanitization', () => {
    const markup = 'x'.repeat(MAX_SVG_SANITIZE_MARKUP_CHARS + 1);

    expect(sanitizeSvgMarkup(markup)).toBe('');
  });
});
