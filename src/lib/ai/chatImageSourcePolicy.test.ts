import { describe, expect, it } from 'vitest';
import {
  extractChatMessageImageSources,
  normalizeChatMessageImageSource,
  normalizeChatMessageImageSources,
  normalizePersistedChatMessageImageSource,
  stripChatMessageImageTokens,
} from './chatImageSourcePolicy';

describe('chatImageSourcePolicy', () => {
  it('normalizes only renderable chat image sources', () => {
    expect(normalizeChatMessageImageSource('https://example.com/image.png')).toBe(
      'https://example.com/image.png',
    );
    expect(normalizeChatMessageImageSource('//example.com/image.png')).toBe(
      'https://example.com/image.png',
    );
    expect(normalizeChatMessageImageSource('data:image/png;base64,QUJD')).toBe(
      'data:image/png;base64,QUJD',
    );
    expect(normalizeChatMessageImageSource('attachment://demo%20image.png')).toBe(
      'attachment://demo%20image.png',
    );
    expect(normalizeChatMessageImageSource('app-file://attachment/demo.png')).toBe(
      'app-file://attachment/demo.png',
    );

    expect(normalizeChatMessageImageSource('javascript:alert(1)')).toBeNull();
    expect(normalizeChatMessageImageSource('http://127.0.0.1:3000/secret.png')).toBeNull();
    expect(normalizeChatMessageImageSource('http://[fe80::1]/secret.png')).toBeNull();
    expect(normalizeChatMessageImageSource('images/demo.png')).toBeNull();
    expect(normalizeChatMessageImageSource('attachment://..%2Fsecret.png')).toBeNull();
    expect(normalizeChatMessageImageSource('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(normalizeChatMessageImageSource('https://example.com/movie.mp4')).toBeNull();
    expect(normalizeChatMessageImageSource(`${' '.repeat((16 * 1024) + 1)}https://example.com/image.png`)).toBeNull();
  });

  it('drops non-persistable blob sources for stored chat metadata', () => {
    expect(normalizeChatMessageImageSource('blob:https://example.com/image')).toBe(
      'blob:https://example.com/image',
    );
    expect(normalizePersistedChatMessageImageSource('blob:https://example.com/image')).toBeNull();
    expect(normalizePersistedChatMessageImageSource('attachment://demo.png')).toBe(
      'attachment://demo.png',
    );
  });

  it('drops non-string sources without coercion', () => {
    const source = {
      toString() {
        throw new Error('source coercion');
      },
    };

    expect(normalizeChatMessageImageSource(source)).toBeNull();
    expect(normalizePersistedChatMessageImageSource(source)).toBeNull();
    expect(normalizeChatMessageImageSources([source, 'https://example.com/image.png'])).toEqual([
      'https://example.com/image.png',
    ]);
  });

  it('extracts and strips only safe rendered image tokens', () => {
    const content = [
      'Before ![safe](https://example.com/safe.png)',
      '![local](http://127.0.0.1:3000/secret.png)',
      '![video](https://example.com/movie.mp4)',
      '<img src="attachment://demo.png">',
      '<img src="javascript:alert(1)">',
      '`![code](https://example.com/code.png)`',
    ].join('\n');

    expect(extractChatMessageImageSources(content)).toEqual([
      'https://example.com/safe.png',
      'attachment://demo.png',
    ]);
    expect(stripChatMessageImageTokens(content)).toBe([
      'Before ',
      '![local](http://127.0.0.1:3000/secret.png)',
      '![video](https://example.com/movie.mp4)',
      '',
      '<img src="javascript:alert(1)">',
      '`![code](https://example.com/code.png)`',
    ].join('\n'));
  });

  it('bounds source normalization work and output size', () => {
    const sources = [
      'https://example.com/one.png',
      'javascript:alert(1)',
      'https://example.com/two.png',
      'https://example.com/three.png',
    ];

    expect(normalizeChatMessageImageSources(sources, {
      maxEntries: 3,
      maxSources: 2,
    })).toEqual([
      'https://example.com/one.png',
      'https://example.com/two.png',
    ]);
  });
});
