import { describe, expect, it } from 'vitest';
import {
  MAX_ELECTRON_EXTERNAL_URL_CHARS,
  normalizeExternalUrl,
  normalizeHttpUrl,
  normalizeProxyConfig,
  summarizeUrlForLog,
} from '../../electron/externalUrlPolicy.mjs';

describe('electron external URL policy', () => {
  it('normalizes supported external URL protocols', () => {
    expect(normalizeExternalUrl(' https://example.com/path?q=1 ')).toBe('https://example.com/path?q=1');
    expect(normalizeExternalUrl('mailto:support@example.com')).toBe('mailto:support@example.com');
  });

  it('rejects unsupported and overlong external URLs', () => {
    expect(() => normalizeExternalUrl('javascript:alert(1)')).toThrow('Unsupported external URL protocol');
    expect(() => normalizeExternalUrl(`https://example.com/${'a'.repeat(MAX_ELECTRON_EXTERNAL_URL_CHARS)}`))
      .toThrow('URL is too long');
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

  it('rejects unsupported or overlong proxy URLs', () => {
    expect(normalizeProxyConfig('file:///tmp/proxy', 'env')).toBeNull();
    expect(normalizeProxyConfig(`http://example.com/${'a'.repeat(MAX_ELECTRON_EXTERNAL_URL_CHARS)}`, 'env'))
      .toBeNull();
  });

  it('summarizes URLs for logs without credentials, query, or fragment', () => {
    expect(summarizeUrlForLog('https://user:secret@example.com/path?q=1#frag')).toBe('https://example.com/path');
    expect(summarizeUrlForLog(`https://example.com/${'a'.repeat(MAX_ELECTRON_EXTERNAL_URL_CHARS)}`)).toBe('');
  });
});
