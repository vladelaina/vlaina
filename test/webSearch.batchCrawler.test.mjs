import { describe, expect, it } from 'vitest';
import { readUrlsBatch } from '../electron/webSearch/batchCrawler.mjs';

describe('batch crawler', () => {
  it('keeps each URL result independent', async () => {
    const crawler = {
      async readUrl(url) {
        if (url.includes('fail')) {
          throw new Error('HTTP 404');
        }
        return {
          title: 'OK',
          summary: '',
          siteName: 'example.com',
          finalUrl: url,
          content: 'content',
          charCount: 7,
        };
      },
    };

    const results = await readUrlsBatch(crawler, [
      'https://ok.example',
      'https://fail.example',
    ]);

    expect(results).toEqual([
      {
        url: 'https://ok.example',
        ok: true,
        page: {
          title: 'OK',
          summary: '',
          siteName: 'example.com',
          finalUrl: 'https://ok.example',
          content: 'content',
          charCount: 7,
        },
      },
      {
        url: 'https://fail.example',
        ok: false,
        error: 'HTTP 404',
        code: 'read_failed',
      },
    ]);
  });

  it('retries transient crawl failures per URL', async () => {
    let attempts = 0;
    const crawler = {
      async readUrl(url) {
        attempts += 1;
        if (attempts === 1) {
          throw Object.assign(new Error('temporary network error'), { code: 'network_error' });
        }
        return {
          title: 'Recovered',
          summary: '',
          siteName: 'example.com',
          finalUrl: url,
          content: 'content',
          charCount: 7,
        };
      },
    };

    const results = await readUrlsBatch(crawler, ['https://ok.example'], { retries: 1 });

    expect(attempts).toBe(2);
    expect(results[0]).toMatchObject({
      ok: true,
      page: {
        title: 'Recovered',
      },
    });
  });

  it('does not retry permanent crawl failures', async () => {
    let attempts = 0;
    const crawler = {
      async readUrl() {
        attempts += 1;
        throw Object.assign(new Error('blocked'), { code: 'blocked_source' });
      },
    };

    const results = await readUrlsBatch(crawler, ['https://blocked.example'], { retries: 2 });

    expect(attempts).toBe(1);
    expect(results[0]).toMatchObject({
      ok: false,
      code: 'blocked_source',
    });
  });
});
