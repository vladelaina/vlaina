import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSvgDataUrl, rasterizeSvgDataUrlToPng } from './svgRasterize';

describe('svgRasterize', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('recognizes only exact SVG data URL media types', () => {
    expect(isSvgDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true);
    expect(isSvgDataUrl('DATA:IMAGE/SVG+XML,%3Csvg%3E')).toBe(true);
    expect(isSvgDataUrl('data:image/svg+xmlbad,%3Csvg%3E')).toBe(false);
    expect(isSvgDataUrl('data:image/png;base64,PHN2Zz4=')).toBe(false);
  });

  it('sanitizes SVG data before assigning it to the decoder image', async () => {
    const assignedSources: string[] = [];
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        assignedSources.push(value);
        queueMicrotask(() => this.onload?.());
      }
    });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            clearRect: vi.fn(),
            drawImage: vi.fn(),
          }),
          toDataURL: () => 'data:image/png;base64,RASTER',
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3" onload="alert(1)">',
      '<script>alert(1)</script>',
      '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
      '<image href="https://example.test/a.png" xlink:href="https://example.test/b.png"></image>',
      '<rect filter="url(https://example.test/filter.svg#drop)" fill="url(#local-fill)"></rect>',
      '<text style="fill:url(#local-fill); stroke:url(https://example.test/stroke.svg#x); opacity:.8">safe</text>',
      '<circle cx="1" cy="1" r="1"></circle>',
      '</svg>',
    ].join('');

    await expect(rasterizeSvgDataUrlToPng(`data:image/svg+xml,${encodeURIComponent(svg)}`)).resolves.toBe(
      'data:image/png;base64,RASTER',
    );

    const assigned = assignedSources[0] ?? '';
    const decoded = decodeURIComponent(assigned.slice(assigned.indexOf(',') + 1));
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('<circle');
    expect(decoded).toContain('url(#local-fill)');
    expect(decoded).not.toContain('<script');
    expect(decoded).not.toContain('foreignObject');
    expect(decoded).not.toContain('javascript:');
    expect(decoded).not.toContain('example.test');
    expect(decoded).not.toContain('onload');
  });
});
