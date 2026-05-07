import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderNoteExportHtml } from './noteExportHtml';

function parseExportHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('renderNoteExportHtml', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(performance.now()), 0);
      return 1;
    });
  });

  it('sanitizes raw HTML, event handlers, and unsafe links', async () => {
    const html = await renderNoteExportHtml(
      [
        '<script>alert(1)</script>',
        '<svg><script>alert(2)</script></svg>',
        '<a href="javascript:alert(3)" onclick="alert(4)">bad</a>',
        '<a href="file:///etc/passwd">file</a>',
        '<a href="https://example.com" onclick="alert(5)">safe</a>',
        '<a href="mailto:user@example.com">mail</a>',
        '<img src="assets/demo.png" onerror="alert(6)" alt="demo">',
      ].join('\n'),
      'Unsafe <Title>',
    );
    const doc = parseExportHtml(html);

    expect(doc.querySelector('title')?.textContent).toBe('Unsafe <Title>');
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('svg')).toBeNull();
    expect(doc.querySelector('[onclick]')).toBeNull();
    expect(doc.querySelector('[onerror]')).toBeNull();
    expect(doc.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(doc.querySelector('a[href^="file:"]')).toBeNull();
    expect(doc.querySelector('a[href="https://example.com"]')?.textContent).toBe('safe');
    expect(doc.querySelector('a[href="mailto:user@example.com"]')?.textContent).toBe('mail');
    expect(doc.querySelector('img[src="assets/demo.png"]')?.getAttribute('alt')).toBe('demo');
  });

  it('blocks exported images that can execute code or trigger external loads', async () => {
    const html = await renderNoteExportHtml(
      [
        '![portable](data:image/png;base64,aGk=)',
        '![svg](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+)',
        '![remote](https://example.com/pixel.png)',
        '![local](http://127.0.0.1/pixel.png)',
        '![blob](blob:https://example.com/id)',
        '![absolute](/etc/passwd)',
        '![relative](assets/photo.webp)',
      ].join('\n'),
      'Images',
    );
    const doc = parseExportHtml(html);
    const imageSources = Array.from(doc.querySelectorAll('img')).map((image) => image.getAttribute('src'));

    expect(imageSources).toEqual([
      'data:image/png;base64,aGk=',
      'assets/photo.webp',
    ]);
    expect(html).not.toContain('image/svg+xml');
    expect(html).not.toContain('https://example.com/pixel.png');
    expect(html).not.toContain('http://127.0.0.1/pixel.png');
    expect(html).not.toContain('blob:https://example.com/id');
    expect(html).not.toContain('/etc/passwd');
  });
});
