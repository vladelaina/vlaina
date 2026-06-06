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
    expect(text?.getAttribute('style')).not.toContain('example.test');
    expect(link?.getAttribute('href')).toBe('https://example.test/target');
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
});
