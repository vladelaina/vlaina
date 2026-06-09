import { describe, expect, it } from 'vitest';
import { sanitizeMermaidMarkup } from './mermaidSanitizer';

function renderMarkup(markup: string) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeMermaidMarkup(markup);
  return template.content;
}

describe('mermaidSanitizer', () => {
  it('adds the VLOOK Mermaid SVG alias without dropping existing SVG classes', () => {
    const content = renderMarkup('<svg class="flowchart"><text>safe</text></svg>');
    const svg = content.querySelector('svg');

    expect(svg?.classList.contains('flowchart')).toBe(true);
    expect(svg?.classList.contains('mermaid-svg')).toBe(true);
  });

  it('drops external SVG resource references after DOMPurify sanitization', () => {
    const content = renderMarkup([
      '<svg>',
      '<image href="https://example.test/a.png" xlink:href="https://example.test/b.png"></image>',
      '<feImage href="https://example.test/filter.png"></feImage>',
      '<rect filter="url(https://example.test/filter.svg#drop)" fill="url(#local-fill)"></rect>',
      '<path marker-end="url(https://example.test/marker.svg#arrow)" stroke="url(#local-stroke)"></path>',
      '<text style="fill:url(#local-fill); stroke:url(https://example.test/stroke.svg#x); opacity:.8">safe</text>',
      '<a href="https://example.test/target"><text>link</text></a>',
      '<a href="#local-target"><text>local link</text></a>',
      '</svg>',
    ].join(''));

    const image = content.querySelector('image');
    const feImage = content.querySelector('feImage');
    const rect = content.querySelector('rect');
    const path = content.querySelector('path');
    const text = content.querySelector('text');
    const link = content.querySelector('a');

    expect(image?.getAttribute('href')).toBeNull();
    expect(image?.getAttribute('xlink:href')).toBeNull();
    expect(feImage?.getAttribute('href')).toBeNull();
    expect(rect?.getAttribute('filter')).toBeNull();
    expect(rect?.getAttribute('fill')).toBe('url(#local-fill)');
    expect(path?.getAttribute('marker-end')).toBeNull();
    expect(path?.getAttribute('stroke')).toBe('url(#local-stroke)');
    expect(text?.getAttribute('style')).toContain('fill: url(#local-fill)');
    expect(text?.getAttribute('style')).toContain('opacity: 0.8');
    expect(text?.getAttribute('style') || '').not.toContain('example.test');
    expect(link?.getAttribute('href')).toBeNull();
    expect(content.querySelectorAll('a')[1]?.getAttribute('href')).toBe('#local-target');
  });

  it('drops external SVG references with whitespace around url and href syntax', () => {
    const content = renderMarkup([
      '<svg>',
      '<a href = "https://example.test/target"><text>link</text></a>',
      '<a href = "#local-target"><text>local link</text></a>',
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
    expect(content.querySelectorAll('a')[1]?.getAttribute('href')).toBe('#local-target');
    expect(image?.getAttribute('href')).toBeNull();
    expect(image?.getAttribute('xlink:href')).toBeNull();
    expect(rect?.getAttribute('filter')).toBeNull();
    expect(rect?.getAttribute('fill')).toBe('url ( #local-fill )');
    expect(text?.getAttribute('style') || '').not.toContain('example.test');
  });

  it('keeps Mermaid foreignObject labels as inert SVG text', () => {
    const content = renderMarkup([
      '<svg>',
      '<foreignObject x="-40" y="-12" width="80" height="24">',
      '<div xmlns="http://www.w3.org/1999/xhtml">',
      '<span class="nodeLabel"><p>Subroutine</p><script>alert(1)</script></span>',
      '</div>',
      '</foreignObject>',
      '</svg>',
    ].join(''));

    const label = content.querySelector('text.nodeLabel');
    expect(content.querySelector('foreignObject')).toBeNull();
    expect(content.querySelector('script')).toBeNull();
    expect(label?.textContent).toBe('Subroutine');
    expect(label?.querySelector('tspan')?.getAttribute('dy')).toBe('0.35em');
  });

  it('caps Mermaid foreignObject label lines before creating SVG tspans', () => {
    const content = renderMarkup([
      '<svg>',
      '<foreignObject>',
      '<div xmlns="http://www.w3.org/1999/xhtml">',
      '<span class="nodeLabel">',
      Array.from({ length: 100 }, (_, index) => `<p>line ${index}</p>`).join(''),
      '</span>',
      '</div>',
      '</foreignObject>',
      '</svg>',
    ].join(''));

    expect(content.querySelectorAll('text.nodeLabel tspan')).toHaveLength(64);
  });

  it('drops oversized Mermaid foreignObject label text', () => {
    const content = renderMarkup([
      '<svg>',
      '<foreignObject>',
      '<div xmlns="http://www.w3.org/1999/xhtml">',
      `<span class="nodeLabel">${'x'.repeat(8193)}</span>`,
      '</div>',
      '</foreignObject>',
      '</svg>',
    ].join(''));

    expect(content.querySelector('foreignObject')).toBeNull();
    expect(content.querySelector('text.nodeLabel')).toBeNull();
  });

  it('drops oversized Mermaid markup before DOM sanitization', () => {
    const markup = `<svg><text>${'x'.repeat(2 * 1024 * 1024 + 1)}</text></svg>`;

    expect(sanitizeMermaidMarkup(markup)).toBe('');
  });

  it('drops Mermaid SVG that exceeds the sanitizer depth budget', () => {
    const markup = `${'<svg><g>'.repeat(210)}<image href="https://example.test/a.png"></image>${'</g></svg>'.repeat(210)}`;

    expect(() => sanitizeMermaidMarkup(markup)).not.toThrow();
    expect(sanitizeMermaidMarkup(markup)).toBe('');
  });

  it('drops Mermaid SVG that exceeds the sanitizer node budget', () => {
    const markup = [
      '<svg>',
      Array.from({ length: 20_050 }, (_, index) => `<image href="https://example.test/${index}.png"></image>`).join(''),
      '</svg>',
    ].join('');

    expect(sanitizeMermaidMarkup(markup)).toBe('');
  });

  it('drops oversized Mermaid foreignObject labels before label extraction walks them', () => {
    const markup = [
      '<svg>',
      '<foreignObject>',
      '<div xmlns="http://www.w3.org/1999/xhtml">',
      '<span class="nodeLabel">',
      Array.from({ length: 20_050 }, (_, index) => `<p>line ${index}</p>`).join(''),
      '</span>',
      '</div>',
      '</foreignObject>',
      '</svg>',
    ].join('');

    expect(sanitizeMermaidMarkup(markup)).toBe('');
  });
});
