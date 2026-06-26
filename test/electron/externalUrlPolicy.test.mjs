import { describe, expect, it } from 'vitest';
import {
  MAX_ELECTRON_EXTERNAL_URL_CHARS,
  normalizeExternalUrl,
  normalizeHttpUrl,
  normalizeProxyConfig,
  redactUrlCredentials,
  summarizeUrlForLog,
} from '../../electron/externalUrlPolicy.mjs';

describe('electron external URL policy', () => {
  it('normalizes supported external URL protocols', () => {
    expect(normalizeExternalUrl(' https://example.com/path?q=1 ')).toBe('https://example.com/path?q=1');
    expect(normalizeExternalUrl('mailto:support@example.com')).toBe('mailto:support@example.com');
  });

  it('rejects unsupported and overlong external URLs', () => {
    expect(() => normalizeExternalUrl('javascript:alert(1)')).toThrow('Unsupported external URL protocol');
    expect(() => normalizeExternalUrl(' '.repeat(MAX_ELECTRON_EXTERNAL_URL_CHARS + 1)))
      .toThrow('URL is too long');
    expect(() => normalizeExternalUrl(`https://example.com/${'a'.repeat(MAX_ELECTRON_EXTERNAL_URL_CHARS)}`))
      .toThrow('URL is too long');
  });

  it('rejects ambiguous HTTP URLs without an authority marker', () => {
    expect(() => normalizeExternalUrl('https:example.com/path'))
      .toThrow('HTTP external URLs must include an authority');
    expect(() => normalizeExternalUrl('http:/example.com/path'))
      .toThrow('HTTP external URLs must include an authority');
    expect(() => normalizeHttpUrl('https:example.com/download', 'Download URL'))
      .toThrow('HTTP external URLs must include an authority');
  });

  it('rejects unsafe external URL syntax before opening it in the OS shell', () => {
    expect(() => normalizeExternalUrl('https://example.com/\u202Ecod.exe')).toThrow('URL contains unsafe characters');
    expect(() => normalizeExternalUrl('mailto:user@example.com\r\nbcc:evil@example.com')).toThrow('URL contains unsafe characters');
    expect(() => normalizeExternalUrl(String.raw`https:\example.com\path`)).toThrow('URL contains unsafe characters');
    expect(() => normalizeExternalUrl(String.raw`https://example.com\@evil.test/path`)).toThrow('URL contains unsafe characters');
  });

  it('rejects external URLs with embedded credentials before opening them in the OS shell', () => {
    expect(() => normalizeExternalUrl('https://user:pass@example.com/private'))
      .toThrow('External URLs with credentials are not allowed');
    expect(() => normalizeExternalUrl('http://user@example.com/private'))
      .toThrow('External URLs with credentials are not allowed');
  });

  it('rejects local-network HTTP URLs before opening them in the OS shell', () => {
    expect(() => normalizeExternalUrl('http://localhost:3000/admin')).toThrow('Local-network external URLs are not allowed');
    expect(() => normalizeExternalUrl('http://127.0.0.1:3000/admin')).toThrow('Local-network external URLs are not allowed');
    expect(() => normalizeExternalUrl('http://127.1/admin')).toThrow('Local-network external URLs are not allowed');
    expect(() => normalizeExternalUrl('http://2130706433/admin')).toThrow('Local-network external URLs are not allowed');
    expect(() => normalizeExternalUrl('http://0177.0.0.1/admin')).toThrow('Local-network external URLs are not allowed');
    expect(() => normalizeExternalUrl('http://192.168.1.8/admin')).toThrow('Local-network external URLs are not allowed');
    expect(() => normalizeExternalUrl('http://[::1]/admin')).toThrow('Local-network external URLs are not allowed');
    expect(normalizeExternalUrl('https://example.com/admin')).toBe('https://example.com/admin');
  });

  it('allows local-network HTTP URLs only when explicitly requested', () => {
    expect(normalizeExternalUrl('http://127.0.0.1:3100/latest', {
      allowLocalNetwork: true,
    })).toBe('http://127.0.0.1:3100/latest');
    expect(normalizeHttpUrl('http://localhost:3100/latest', 'Update manifest URL', {
      allowLocalNetwork: true,
    })).toBe('http://localhost:3100/latest');
  });

  it('keeps update URLs restricted to HTTP protocols', () => {
    expect(normalizeHttpUrl('https://example.com/download', 'Download URL')).toBe('https://example.com/download');
    expect(() => normalizeHttpUrl('mailto:support@example.com', 'Download URL')).toThrow(
      'Download URL must be an HTTP or HTTPS URL'
    );
  });

  it('normalizes proxy config without forwarding credentials into proxy rules', () => {
    expect(normalizeProxyConfig('https://user:secret@example.com:8443', 'env')).toEqual({
      proxyServer: 'https://redacted:redacted@example.com:8443/',
      proxyRules: 'http=example.com:8443;https=example.com:8443',
      source: 'env',
    });
  });

  it('does not coerce hostile runtime URL values for logging or proxy normalization', () => {
    const hostileUrl = {
      toString() {
        throw new Error('URL coercion');
      },
    };

    expect(redactUrlCredentials(hostileUrl)).toBe('');
    expect(summarizeUrlForLog(hostileUrl)).toBe('');
    expect(normalizeProxyConfig(hostileUrl, 'env')).toBeNull();
  });

  it('rejects unsupported or overlong proxy URLs', () => {
    expect(normalizeProxyConfig('file:///tmp/proxy', 'env')).toBeNull();
    expect(normalizeProxyConfig('http:example.com:8080', 'env')).toBeNull();
    expect(normalizeProxyConfig('socks5:127.0.0.1:9050', 'env')).toBeNull();
    expect(normalizeProxyConfig(`http://example.com/${'a'.repeat(MAX_ELECTRON_EXTERNAL_URL_CHARS)}`, 'env'))
      .toBeNull();
  });

  it('summarizes URLs for logs without credentials, query, or fragment', () => {
    expect(summarizeUrlForLog('https://user:secret@example.com/path?q=1#frag')).toBe('https://example.com/path');
    expect(summarizeUrlForLog(`https://example.com/${'a'.repeat(MAX_ELECTRON_EXTERNAL_URL_CHARS)}`)).toBe('');
  });
});
