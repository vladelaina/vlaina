import { describe, expect, it } from 'vitest';
import {
  MAX_FORMATTED_BATCH_WEB_PAGES,
  formatBatchPagesForModel,
  formatSearchResultsForModel,
} from './format';

describe('web search model formatting', () => {
  it('formats only the top search candidates', () => {
    const text = formatSearchResultsForModel({
      query: 'vlaina',
      results: Array.from({ length: 7 }, (_, index) => ({
        title: `Result ${index + 1}`,
        url: `https://example.com/${index + 1}`,
        snippet: 'Snippet',
        publishedAt: null,
        source: null,
        thumbnail: null,
      })),
    });

    expect(text).toContain('Result 1');
    expect(text).toContain('Result 5');
    expect(text).not.toContain('Result 6');
  });

  it('omits unsafe search result URLs from model context', () => {
    const text = formatSearchResultsForModel({
      query: 'local admin',
      results: [
        {
          title: 'Local admin',
          url: 'http://127.0.0.1:3000/admin',
          snippet: 'Should not be exposed',
          publishedAt: null,
          source: null,
          thumbnail: null,
        },
        {
          title: 'Relative path',
          url: '/admin',
          snippet: 'Should not be exposed',
          publishedAt: null,
          source: null,
          thumbnail: null,
        },
        {
          title: 'Safe result',
          url: 'https://example.com/safe',
          snippet: 'Allowed summary',
          publishedAt: null,
          source: null,
          thumbnail: null,
        },
      ],
    });

    expect(text).toContain('Safe result');
    expect(text).toContain('https://example.com/safe');
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('/admin');
    expect(text).not.toContain('Should not be exposed');
  });

  it('clips search metadata before returning model context', () => {
    const text = formatSearchResultsForModel({
      query: 'q'.repeat(520),
      results: [{
        title: 't'.repeat(320),
        url: 'https://example.com/long',
        snippet: 's'.repeat(1100),
        publishedAt: 'p'.repeat(120),
        source: 'source'.repeat(50),
        thumbnail: null,
      }],
    });

    expect(text).toContain(`${'q'.repeat(500)}\n[truncated]`);
    expect(text).toContain(`${'t'.repeat(300)}\n[truncated]`);
    expect(text).toContain(`${'s'.repeat(1000)}\n[truncated]`);
    expect(text).toContain(`${'p'.repeat(100)}\n[truncated]`);
    expect(text).toContain(`Source: ${'source'.repeat(33)}so\n[truncated]`);
    expect(text).not.toContain('q'.repeat(501));
    expect(text).not.toContain('t'.repeat(301));
    expect(text).not.toContain('s'.repeat(1001));
  });

  it('keeps batch page failures isolated', () => {
    const text = formatBatchPagesForModel([
      {
        url: 'https://ok.example',
        ok: true,
        page: {
          title: 'OK',
          summary: '',
          siteName: 'ok.example',
          finalUrl: 'https://ok.example',
          content: 'Readable content',
          charCount: 16,
        },
      },
      {
        url: 'https://fail.example',
        ok: false,
        error: 'HTTP 404',
        code: 'http_error',
      },
    ]);

    expect(text).toContain('Page 1: success');
    expect(text).toContain('Readable content');
    expect(text).toContain('Page 2: failed');
    expect(text).toContain('The page returned an HTTP error.');
    expect(text).not.toContain('HTTP 404');
  });

  it('hides unsafe page URLs from model context', () => {
    const text = formatBatchPagesForModel([
      {
        url: 'https://example.com/input',
        ok: true,
        page: {
          title: 'Loopback page',
          summary: '',
          siteName: 'localhost',
          finalUrl: 'http://127.0.0.1:5173/private',
          content: 'Readable content',
          charCount: 16,
        },
      },
      {
        url: 'http://localhost:11434/',
        ok: false,
        error: 'Raw local error',
        code: 'network_error',
      },
    ]);

    expect(text).toContain('Page 1: success');
    expect(text).toContain('URL: (unavailable)');
    expect(text).toContain('Page 2: failed');
    expect(text).toContain('The page could not be reached.');
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('localhost:11434');
    expect(text).not.toContain('Raw local error');
  });

  it('clips page metadata before returning model context', () => {
    const text = formatBatchPagesForModel([
      {
        url: 'https://example.com/input',
        ok: true,
        page: {
          title: 't'.repeat(320),
          summary: 's'.repeat(1100),
          siteName: 'site'.repeat(60),
          finalUrl: 'https://example.com/page',
          content: 'c'.repeat(3100),
          charCount: 3100,
        },
      },
    ]);

    expect(text).toContain(`${'t'.repeat(300)}\n[truncated]`);
    expect(text).toContain(`${'s'.repeat(1000)}\n[truncated]`);
    expect(text).toContain(`${'site'.repeat(50)}\n[truncated]`);
    expect(text).toContain(`${'c'.repeat(3000)}\n[truncated]`);
    expect(text).not.toContain('t'.repeat(301));
    expect(text).not.toContain('s'.repeat(1001));
    expect(text).not.toContain('c'.repeat(3001));
  });

  it('bounds formatted batch pages returned by the web search backend', () => {
    const text = formatBatchPagesForModel(Array.from(
      { length: MAX_FORMATTED_BATCH_WEB_PAGES + 1 },
      (_value, index) => ({
        url: `https://example.com/${index}`,
        ok: true as const,
        page: {
          title: `Page ${index}`,
          summary: '',
          siteName: 'example.com',
          finalUrl: `https://example.com/${index}`,
          content: `Readable content ${index}`,
          charCount: 18,
        },
      }),
    ));

    expect(text).toContain(`Page ${MAX_FORMATTED_BATCH_WEB_PAGES}: success`);
    expect(text).toContain(`Readable content ${MAX_FORMATTED_BATCH_WEB_PAGES - 1}`);
    expect(text).not.toContain(`Page ${MAX_FORMATTED_BATCH_WEB_PAGES + 1}: success`);
    expect(text).not.toContain(`Readable content ${MAX_FORMATTED_BATCH_WEB_PAGES}`);
  });
});
