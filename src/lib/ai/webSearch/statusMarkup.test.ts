import { describe, expect, it } from 'vitest';
import { buildWebSearchStatusMarkup, extractWebSearchStatuses, sanitizeWebSearchSourceUrl } from './statusMarkup';

describe('web search status markup', () => {
  it('round-trips status payloads and removes markup from content', () => {
    const markup = buildWebSearchStatusMarkup({
      phase: 'results',
      query: 'a < b & c',
      results: [{ title: 'Title', url: 'https://example.com', snippet: 'Summary', publishedAt: null }],
    });

    const parsed = extractWebSearchStatuses(`${markup}\n\nAnswer`);

    expect(parsed.statuses).toEqual([
      {
        phase: 'results',
        query: 'a < b & c',
        results: [{ title: 'Title', url: 'https://example.com', snippet: 'Summary', publishedAt: null }],
      },
    ]);
    expect(parsed.content).toBe('Answer');
  });

  it('drops malformed or unsafe status payload fields', () => {
    const markup = buildWebSearchStatusMarkup({
      phase: 'results',
      query: 'safe',
      urls: ['javascript:alert(1)', 'https://example.com/read'],
      results: [
        { title: 'Unsafe', url: 'javascript:alert(1)', snippet: 'Bad', publishedAt: null },
        { title: 'Safe', url: 'https://example.com', snippet: 'Good', publishedAt: null },
      ],
      failedSources: [
        { url: 'data:text/html,hello', message: 'Bad' },
        { url: 'https://example.com/fail', message: 'Skipped' },
      ],
      metrics: { durationMs: 12.6 },
    });
    const invalidMarkup = '<web-search-status>{"phase":"invalid","urls":["https://example.com"]}</web-search-status>';

    const parsed = extractWebSearchStatuses(`${markup}${invalidMarkup}Answer`);

    expect(parsed.statuses).toEqual([
      {
        phase: 'results',
        query: 'safe',
        urls: ['https://example.com/read'],
        results: [{ title: 'Safe', url: 'https://example.com', snippet: 'Good', publishedAt: null }],
        failedSources: [{ url: 'https://example.com/fail', message: 'Skipped' }],
        metrics: { durationMs: 13 },
      },
    ]);
    expect(parsed.content).toBe('Answer');
  });

  it('drops local network and control-character source URLs', () => {
    const markup = buildWebSearchStatusMarkup({
      phase: 'results',
      urls: [
        'https://example.com/read',
        'http://127.0.0.1:3000/admin',
        'http://localhost/admin',
        'http://router/admin',
        'http://192.168.1.1/admin',
        'https://example.com/\u202Ecod.exe',
      ],
      results: [
        { title: 'Loopback', url: 'http://2130706433/admin', snippet: 'Bad', publishedAt: null },
        { title: 'Safe', url: ' https://safe.example/article ', snippet: 'Good', publishedAt: null },
      ],
      failedSources: [
        { url: 'http://[::1]/admin', message: 'Bad' },
        { url: 'https://safe.example/fail', message: 'Skipped' },
      ],
    });

    const parsed = extractWebSearchStatuses(`${markup}Answer`);

    expect(parsed.statuses).toEqual([
      {
        phase: 'results',
        urls: ['https://example.com/read'],
        results: [{ title: 'Safe', url: 'https://safe.example/article', snippet: 'Good', publishedAt: null }],
        failedSources: [{ url: 'https://safe.example/fail', message: 'Skipped' }],
      },
    ]);
    expect(parsed.content).toBe('Answer');
  });

  it('accepts only public http sources', () => {
    expect(sanitizeWebSearchSourceUrl('https://example.com')).toBe('https://example.com');
    expect(sanitizeWebSearchSourceUrl('http://example.com/path')).toBe('http://example.com/path');
    expect(sanitizeWebSearchSourceUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeWebSearchSourceUrl('data:text/html,hello')).toBeNull();
    expect(sanitizeWebSearchSourceUrl('mailto:user@example.com')).toBeNull();
    expect(sanitizeWebSearchSourceUrl('/relative')).toBeNull();
    expect(sanitizeWebSearchSourceUrl('http://10.0.0.1/admin')).toBeNull();
    expect(sanitizeWebSearchSourceUrl('http://service.local/admin')).toBeNull();
    expect(sanitizeWebSearchSourceUrl('https://example.com/\u0000path')).toBeNull();
  });
});
