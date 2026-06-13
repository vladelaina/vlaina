import { describe, expect, it, vi } from 'vitest';
import {
  MAX_SVG_SANITIZE_BYTES,
  MAX_SVG_SANITIZE_MARKUP_CHARS,
  sanitizeSvgBytes,
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

  it('drops SVG style elements that can load external resources', () => {
    const content = renderSanitizedSvg([
      '<svg xmlns="http://www.w3.org/2000/svg">',
      '<style>.safe { fill: red; }</style>',
      '<style>@import "https://example.test/theme.css"; .bad { fill: red; }</style>',
      '<style>.bad { filter: url(https://example.test/filter.svg#drop); }</style>',
      '<style>.local { filter: url(#local-filter); }</style>',
      '<text class="safe local">safe</text>',
      '</svg>',
    ].join(''));

    const styles = Array.from(content.querySelectorAll('style')).map((style) => style.textContent || '');

    expect(styles).toHaveLength(2);
    expect(styles.join('\n')).toContain('.safe');
    expect(styles.join('\n')).toContain('url(#local-filter)');
    expect(styles.join('\n')).not.toContain('@import');
    expect(styles.join('\n')).not.toContain('example.test');
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

  it('drops oversized SVG bytes before decoding them', () => {
    const decode = vi.spyOn(TextDecoder.prototype, 'decode');

    try {
      expect(sanitizeSvgBytes(new Uint8Array(MAX_SVG_SANITIZE_BYTES + 1))).toHaveLength(0);
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }
  });
});
