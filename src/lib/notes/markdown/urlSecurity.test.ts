import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isLocalNetworkHttpUrl,
  isPublicRemoteMediaUrl,
  sanitizeNoteLinkHref,
  sanitizeNoteMediaSrc,
} from './urlSecurity';

describe('urlSecurity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks local-network media URLs without a browser window', () => {
    vi.stubGlobal('window', undefined);

    expect(isLocalNetworkHttpUrl('http://127.0.0.1:3000/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('//127.0.0.1:3000/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://localhost./image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://assets.localhost/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://printer.local/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://router/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://device.home.arpa/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://100.64.0.1/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://198.18.0.1/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://224.0.0.1/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://[::]/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://[ff02::1]/image.png')).toBe(true);
    expect(isPublicRemoteMediaUrl('http://127.0.0.1:3000/image.png')).toBe(false);
    expect(isPublicRemoteMediaUrl('http://assets.localhost/image.png')).toBe(false);
    expect(isPublicRemoteMediaUrl('http://router/image.png')).toBe(false);
    expect(sanitizeNoteMediaSrc('http://127.0.0.1:3000/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('//127.0.0.1:3000/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://localhost./image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://assets.localhost/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://printer.local/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://100.64.0.1/image.png')).toBeNull();
  });

  it('allows public media URLs without a browser window', () => {
    vi.stubGlobal('window', undefined);

    expect(isLocalNetworkHttpUrl('https://example.com/image.png')).toBe(false);
    expect(isLocalNetworkHttpUrl('https://100.128.0.1/image.png')).toBe(false);
    expect(isLocalNetworkHttpUrl('https://[2606:4700:4700::1111]/image.png')).toBe(false);
    expect(isPublicRemoteMediaUrl('https://example.com/image.png')).toBe(true);
    expect(isPublicRemoteMediaUrl('https://100.128.0.1/image.png')).toBe(true);
    expect(isPublicRemoteMediaUrl('https://[2606:4700:4700::1111]/image.png')).toBe(true);
    expect(sanitizeNoteMediaSrc('https://example.com/image.png')).toBe('https://example.com/image.png');
    expect(sanitizeNoteMediaSrc('https://[2606:4700:4700::1111]/image.png')).toBe('https://[2606:4700:4700::1111]/image.png');
  });

  it('does not classify unsafe remote strings as public media URLs', () => {
    expect(isPublicRemoteMediaUrl('https://example.com/\u202Ecod.exe')).toBe(false);
    expect(isPublicRemoteMediaUrl('https://example.com/image.png\u0000')).toBe(false);
    expect(isPublicRemoteMediaUrl('//example.com/image.png\uFFFD')).toBe(false);
  });

  it('rejects protocol-relative links while keeping normal relative note links', () => {
    expect(sanitizeNoteLinkHref('//example.com/path')).toBeNull();
    expect(sanitizeNoteLinkHref('docs/alpha.md')).toBe('docs/alpha.md');
    expect(sanitizeNoteLinkHref('./docs/alpha.md')).toBe('./docs/alpha.md');
    expect(sanitizeNoteLinkHref('../docs/alpha.md')).toBe('../docs/alpha.md');
    expect(sanitizeNoteLinkHref('#heading')).toBe('#heading');
  });
});
