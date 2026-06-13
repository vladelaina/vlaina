import { describe, expect, it } from 'vitest';
import { sanitizeRawHtmlUrlProperties } from './rawHtmlUrlPolicy';

function element(tagName: string, properties: Record<string, unknown>) {
  return {
    type: 'element',
    tagName,
    properties: { ...properties },
    children: [],
  };
}

describe('sanitizeRawHtmlUrlProperties', () => {
  it('sanitizes raw img src values at the HAST layer', () => {
    const cases = [
      ['javascript:alert(1)', null],
      ['file:///etc/passwd', null],
      ['/etc/passwd', null],
      ['http://127.0.0.1:3000/secret.png', null],
      ['http://[fe90::1]/secret.png', null],
      ['http://[fec0::1]/secret.png', null],
      ['https://user:pass@example.com/secret.png', null],
      ['.vlaina/private.png', null],
      ['docs/%252egit/private.png', null],
      ['https://example.com/safe.png', 'https://example.com/safe.png'],
      ['//example.com/safe.png', 'https://example.com/safe.png'],
      ['data:image/png;base64,aGk=', 'data:image/png;base64,aGk='],
      [String.raw`data\:image/png;base64,aGk=`, null],
      [String.raw`https\://example.com/safe.png`, null],
      ['asset://localhost/chat-inline-image/0', 'asset://localhost/chat-inline-image/0'],
      ['attachment://demo%20image.png', 'attachment://demo%20image.png'],
      [String.raw`attachment\://demo%20image.png`, null],
      ['.notes/public.png', '.notes/public.png'],
    ] as const;

    for (const [src, expected] of cases) {
      const node = element('img', { src });
      sanitizeRawHtmlUrlProperties(node);
      if (expected === null) {
        expect(node.properties).not.toHaveProperty('src');
      } else {
        expect(node.properties.src).toBe(expected);
      }
    }
  });

  it('sanitizes raw source srcset values at the HAST layer', () => {
    const cases = [
      ['//127.0.0.1:3000/secret.webp 1x', null],
      ['https://user:pass@example.com/secret.webp 1x', null],
      [String.raw`https\://example.com/safe.webp 1x`, null],
      [String.raw`data\:image/png;base64,aGk= 1x`, null],
      ['.vlaina/private.webp 1x', null],
      ['docs/%252egit/private.webp 1x', null],
      ['images/safe.webp 1x, https://example.com/safe@2x.webp 2x', 'images/safe.webp 1x, https://example.com/safe@2x.webp 2x'],
      ['//example.com/safe.webp 1x', 'https://example.com/safe.webp 1x'],
    ] as const;

    for (const [srcset, expected] of cases) {
      const node = element('source', { srcSet: srcset });
      sanitizeRawHtmlUrlProperties(node);
      if (expected === null) {
        expect(node.properties).not.toHaveProperty('srcSet');
      } else {
        expect(node.properties.srcSet).toBe(expected);
      }
    }

    const lowerCaseNode = element('source', { srcset: 'images/safe.webp 1x' });
    sanitizeRawHtmlUrlProperties(lowerCaseNode);
    expect(lowerCaseNode.properties.srcset).toBe('images/safe.webp 1x');
  });

  it('drops loadable URL properties that are not allowed for the tag', () => {
    const node = element('div', {
      action: 'https://example.com/action',
      formAction: 'javascript:alert(1)',
      href: 'https://example.com/link',
      poster: 'https://example.com/poster.png',
      src: 'https://example.com/image.png',
      title: 'safe title',
    });

    sanitizeRawHtmlUrlProperties(node);

    expect(node.properties).toEqual({ title: 'safe title' });
  });

  it('forces safe iframe referrer policy at the HAST layer', () => {
    const node = element('iframe', {
      referrerPolicy: 'unsafe-url',
      sandbox: 'allow-same-origin allow-scripts',
      src: 'https://example.com/embed',
    });

    sanitizeRawHtmlUrlProperties(node);

    expect(node.properties.referrerPolicy).toBe('no-referrer');
    expect(node.properties.sandbox).toBe('allow-scripts');
  });

  it('drops protocol-relative urls with backslashes at the HAST layer', () => {
    const iframe = element('iframe', { src: String.raw`//example.com\embed` });
    const video = element('video', { poster: String.raw`//example.com\poster.png` });

    sanitizeRawHtmlUrlProperties(iframe);
    sanitizeRawHtmlUrlProperties(video);

    expect(iframe.tagName).toBe('span');
    expect(iframe.properties).toEqual({});
    expect(video.properties).not.toHaveProperty('poster');
  });

  it('drops document-relative iframe sources at the HAST layer', () => {
    for (const src of ['#self', '?embed', 'embed.html', './embed.html']) {
      const node = element('iframe', { src });
      sanitizeRawHtmlUrlProperties(node);

      expect(node.tagName).toBe('span');
      expect(node.properties).toEqual({});
      expect(node.children).toEqual([]);
    }
  });
});
