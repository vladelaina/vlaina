import { describe, expect, it } from 'vitest';
import { isBlockedIp, normalizePublicHttpUrl } from '../electron/webSearch/ssrfGuard.mjs';

describe('web search SSRF guard', () => {
  it('does not classify normal hostnames as blocked IPs', () => {
    expect(isBlockedIp('example.com')).toBe(false);
  });

  it('blocks loopback and private IPs', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('10.0.0.1')).toBe(true);
    expect(isBlockedIp('192.168.1.1')).toBe(true);
    expect(isBlockedIp('172.16.0.1')).toBe(true);
    expect(isBlockedIp('100.64.0.1')).toBe(true);
    expect(isBlockedIp('198.18.0.1')).toBe(true);
    expect(isBlockedIp('192.0.2.1')).toBe(true);
    expect(isBlockedIp('198.51.100.1')).toBe(true);
    expect(isBlockedIp('203.0.113.1')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('::ffff:172.16.0.1')).toBe(true);
    expect(isBlockedIp('[::ffff:7f00:1]')).toBe(true);
    expect(isBlockedIp('::ffff:169.254.1.1')).toBe(true);
    expect(isBlockedIp('[fe90::1]')).toBe(true);
    expect(isBlockedIp('febf::1')).toBe(true);
    expect(isBlockedIp('fed0::1')).toBe(true);
    expect(isBlockedIp('ff02::1')).toBe(true);
    expect(isBlockedIp('2001:db8::1')).toBe(true);
    expect(isBlockedIp('2002::1')).toBe(true);
  });

  it('allows only http and https URL protocols', () => {
    expect(normalizePublicHttpUrl('https://example.com/path').toString()).toBe('https://example.com/path');
    expect(() => normalizePublicHttpUrl('file:///etc/passwd')).toThrow('Only HTTP and HTTPS URLs are supported.');
  });

  it('rejects URLs with credentials', () => {
    expect(() => normalizePublicHttpUrl('https://user:pass@example.com/path')).toThrow('URL credentials are not supported.');
  });
});
