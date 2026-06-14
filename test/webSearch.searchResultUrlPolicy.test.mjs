import { describe, expect, it, vi } from 'vitest';
import { isBlockedResultUrl, normalizeResultUrl } from '../electron/webSearch/searchResultUrlPolicy.mjs';

describe('web search result URL policy', () => {
  it('unwraps official search redirect URLs', () => {
    const targetUrl = 'https://example.com/page';
    const encodedTarget = Buffer.from(targetUrl).toString('base64url');

    expect(normalizeResultUrl(`https://www.bing.com/ck/a?u=a1${encodedTarget}`)).toBe(targetUrl);
    expect(normalizeResultUrl(`/url?q=${encodeURIComponent(targetUrl)}`)).toBe(targetUrl);
    expect(normalizeResultUrl(`/l/?uddg=${encodeURIComponent(targetUrl)}`)).toBe(targetUrl);
  });

  it('does not unwrap lookalike search redirect hosts', () => {
    const targetUrl = 'https://example.com/page';
    const encodedTarget = Buffer.from(targetUrl).toString('base64url');

    expect(normalizeResultUrl(`https://evilbing.com/ck/a?u=a1${encodedTarget}`)).toBe(
      `https://evilbing.com/ck/a?u=a1${encodedTarget}`,
    );
  });

  it('rejects ambiguous or unsafe result URLs', () => {
    expect(normalizeResultUrl('https:example.com/page')).toBe('');
    expect(normalizeResultUrl('http:/example.com/page')).toBe('');
    expect(normalizeResultUrl('https://example.com\\@internal.test/page')).toBe('');
    expect(normalizeResultUrl('https://example.com/\u202Ecod.exe')).toBe('');

    expect(isBlockedResultUrl('https:example.com/page')).toBe(true);
    expect(isBlockedResultUrl('https://example.com\\@internal.test/page')).toBe(true);
  });

  it('rejects non-string result URLs before coercion', () => {
    const rawUrl = {
      toString: vi.fn(() => {
        throw new Error('url coercion');
      }),
    };

    expect(normalizeResultUrl(rawUrl)).toBe('');
    expect(isBlockedResultUrl(rawUrl)).toBe(true);
    expect(rawUrl.toString).not.toHaveBeenCalled();
  });

  it('blocks local-network result hosts', () => {
    expect(isBlockedResultUrl('http://router/admin')).toBe(true);
    expect(isBlockedResultUrl('http://service.home.arpa/admin')).toBe(true);
    expect(isBlockedResultUrl('http://assets.localhost/admin')).toBe(true);
    expect(isBlockedResultUrl('http://10.0.0.1/admin')).toBe(true);
    expect(isBlockedResultUrl('https://example.com/read')).toBe(false);
  });
});
