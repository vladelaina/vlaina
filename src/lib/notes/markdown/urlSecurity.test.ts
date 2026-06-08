import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_INLINE_IMAGE_BYTES } from '@/lib/markdown/dataImagePolicy';
import {
  getNoteInternalImageAssetPath,
  isLocalNetworkHttpUrl,
  isPublicRemoteMediaUrl,
  normalizePublicRemoteMediaUrl,
  sanitizeNoteLinkHref,
  sanitizeNoteMediaSrc,
} from './urlSecurity';

function createOversizedDataImageSrc(): string {
  const payload = 'A'.repeat(Math.ceil((MAX_INLINE_IMAGE_BYTES + 1) / 3) * 4);
  return `data:image/png;base64,${payload}`;
}

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
    expect(isLocalNetworkHttpUrl('http://[::7f00:1]/image.png')).toBe(true);
    expect(isLocalNetworkHttpUrl('http://[::ffff:0:7f00:1]/image.png')).toBe(true);
    expect(isPublicRemoteMediaUrl('http://127.0.0.1:3000/image.png')).toBe(false);
    expect(isPublicRemoteMediaUrl('http://[::7f00:1]/image.png')).toBe(false);
    expect(isPublicRemoteMediaUrl(String.raw`http:\127.0.0.1\image.png`)).toBe(false);
    expect(isPublicRemoteMediaUrl(String.raw`\\127.0.0.1\image.png`)).toBe(false);
    expect(isPublicRemoteMediaUrl('http://assets.localhost/image.png')).toBe(false);
    expect(isPublicRemoteMediaUrl('http://router/image.png')).toBe(false);
    expect(sanitizeNoteMediaSrc('http://127.0.0.1:3000/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('//127.0.0.1:3000/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://localhost./image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://assets.localhost/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://printer.local/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://100.64.0.1/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://[::7f00:1]/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('http://[::ffff:0:7f00:1]/image.png')).toBeNull();
    expect(sanitizeNoteMediaSrc(String.raw`http:\127.0.0.1\image.png`)).toBeNull();
    expect(sanitizeNoteMediaSrc(String.raw`\\127.0.0.1\image.png`)).toBeNull();
  });

  it('allows public media URLs without a browser window', () => {
    vi.stubGlobal('window', undefined);

    expect(isLocalNetworkHttpUrl('https://example.com/image.png')).toBe(false);
    expect(isLocalNetworkHttpUrl('https://100.128.0.1/image.png')).toBe(false);
    expect(isLocalNetworkHttpUrl('https://[::ffff:10000:7f00]/image.png')).toBe(false);
    expect(isLocalNetworkHttpUrl('https://[2606:4700:4700::1111]/image.png')).toBe(false);
    expect(isPublicRemoteMediaUrl('https://example.com/image.png')).toBe(true);
    expect(isPublicRemoteMediaUrl('https://100.128.0.1/image.png')).toBe(true);
    expect(isPublicRemoteMediaUrl('https://[2606:4700:4700::1111]/image.png')).toBe(true);
    expect(isPublicRemoteMediaUrl('//example.com/image.png')).toBe(true);
    expect(normalizePublicRemoteMediaUrl('//example.com/image.png')).toBe('https://example.com/image.png');
    expect(normalizePublicRemoteMediaUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
    expect(sanitizeNoteMediaSrc('https://example.com/image.png')).toBe('https://example.com/image.png');
    expect(sanitizeNoteMediaSrc('//example.com/image.png')).toBe('https://example.com/image.png');
    expect(sanitizeNoteMediaSrc('https://[2606:4700:4700::1111]/image.png')).toBe('https://[2606:4700:4700::1111]/image.png');
  });

  it('allows only safe raster data image media sources', () => {
    expect(sanitizeNoteMediaSrc('data:image/png;base64,aGk=')).toBe('data:image/png;base64,aGk=');
    expect(sanitizeNoteMediaSrc('DATA:IMAGE/WEBP;BASE64,AQI=')).toBe('data:image/webp;base64,AQI=');
    expect(sanitizeNoteMediaSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(sanitizeNoteMediaSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(sanitizeNoteMediaSrc('data:image/png,not-base64')).toBeNull();
    expect(sanitizeNoteMediaSrc(createOversizedDataImageSrc())).toBeNull();
  });

  it('does not classify unsafe remote strings as public media URLs', () => {
    expect(isPublicRemoteMediaUrl('https://example.com/\u202Ecod.exe')).toBe(false);
    expect(isPublicRemoteMediaUrl('https://example.com/image.png\u0000')).toBe(false);
    expect(isPublicRemoteMediaUrl('//example.com/image.png\uFFFD')).toBe(false);
    expect(normalizePublicRemoteMediaUrl('//127.0.0.1:3000/image.png')).toBeNull();
  });

  it('allows only relative internal image asset refs', () => {
    expect(getNoteInternalImageAssetPath('img:assets/demo.png')).toBe('assets/demo.png');
    expect(getNoteInternalImageAssetPath('IMG:assets/demo.png?cache=1')).toBe('assets/demo.png?cache=1');
    expect(getNoteInternalImageAssetPath('img:.notes/demo.png')).toBe('.notes/demo.png');
    expect(getNoteInternalImageAssetPath('img:%2enotes/demo.png')).toBe('%2enotes/demo.png');
    expect(sanitizeNoteMediaSrc('img:assets/demo.png')).toBe('img:assets/demo.png');
    expect(sanitizeNoteMediaSrc('IMG:assets/demo.png')).toBe('IMG:assets/demo.png');
    expect(sanitizeNoteMediaSrc('img:.notes/demo.png')).toBe('img:.notes/demo.png');

    expect(getNoteInternalImageAssetPath('img:/etc/passwd')).toBeNull();
    expect(getNoteInternalImageAssetPath('img:\\secret.png')).toBeNull();
    expect(getNoteInternalImageAssetPath('img://example.com/demo.png')).toBeNull();
    expect(getNoteInternalImageAssetPath('img:C:\\Users\\secret.png')).toBeNull();
    expect(getNoteInternalImageAssetPath('img:assets/\u202Ecod.exe')).toBeNull();
    expect(getNoteInternalImageAssetPath('img:.vlaina/assets/demo.png')).toBeNull();
    expect(getNoteInternalImageAssetPath('img:docs/.GIT/demo.png')).toBeNull();
    expect(getNoteInternalImageAssetPath('img:%2evlaina/assets/demo.png')).toBeNull();
    expect(getNoteInternalImageAssetPath('img:docs/%252egit/demo.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('img:/etc/passwd')).toBeNull();
    expect(sanitizeNoteMediaSrc('img://example.com/demo.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('img:.vlaina/assets/demo.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('img:docs/.GIT/demo.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('.vlaina/assets/demo.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('./docs/.GIT/demo.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('docs/%252egit/demo.png')).toBeNull();
    expect(sanitizeNoteMediaSrc('.notes/demo.png')).toBe('.notes/demo.png');
  });

  it('rejects oversized media URLs and internal image refs', () => {
    const oversizedPath = `${'a'.repeat(16 * 1024)}.png`;

    expect(isPublicRemoteMediaUrl(`https://example.com/${oversizedPath}`)).toBe(false);
    expect(normalizePublicRemoteMediaUrl(`https://example.com/${oversizedPath}`)).toBeNull();
    expect(sanitizeNoteMediaSrc(`https://example.com/${oversizedPath}`)).toBeNull();
    expect(getNoteInternalImageAssetPath(`img:${oversizedPath}`)).toBeNull();
    expect(sanitizeNoteMediaSrc(`img:${oversizedPath}`)).toBeNull();
    expect(sanitizeNoteMediaSrc(oversizedPath)).toBeNull();
  });

  it('rejects protocol-relative links while keeping normal relative note links', () => {
    expect(sanitizeNoteLinkHref('//example.com/path')).toBeNull();
    expect(sanitizeNoteLinkHref('docs/alpha.md')).toBe('docs/alpha.md');
    expect(sanitizeNoteLinkHref('./docs/alpha.md')).toBe('./docs/alpha.md');
    expect(sanitizeNoteLinkHref('../docs/alpha.md')).toBe('../docs/alpha.md');
    expect(sanitizeNoteLinkHref('#heading')).toBe('#heading');
    expect(sanitizeNoteLinkHref('.notes/alpha.md')).toBe('.notes/alpha.md');
    expect(sanitizeNoteLinkHref(String.raw`https:\example.com\path`)).toBeNull();
    expect(sanitizeNoteLinkHref(String.raw`\\example.com\path`)).toBeNull();
  });

  it('rejects relative links into internal note folders', () => {
    expect(sanitizeNoteLinkHref('.vlaina/workspace.md')).toBeNull();
    expect(sanitizeNoteLinkHref('./.vlaina/workspace.md')).toBeNull();
    expect(sanitizeNoteLinkHref('docs/.git/config.md')).toBeNull();
    expect(sanitizeNoteLinkHref('docs/.GIT/config.md')).toBeNull();
    expect(sanitizeNoteLinkHref('%2evlaina/workspace.md')).toBeNull();
    expect(sanitizeNoteLinkHref('docs/%252egit/config.md')).toBeNull();
    expect(sanitizeNoteLinkHref('https://example.com/.git/config.md')).toBe('https://example.com/.git/config.md');
  });

  it('rejects oversized note link hrefs', () => {
    expect(sanitizeNoteLinkHref(`${'a'.repeat(16 * 1024)}.md`)).toBeNull();
  });
});
