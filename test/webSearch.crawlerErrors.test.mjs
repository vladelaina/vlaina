import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Crawler } from '../electron/webSearch/crawler.mjs';
import { prepareCrawlerUrl } from '../electron/webSearch/crawlerUrlPolicy.mjs';

describe('crawler error classification', () => {
  it('classifies invalid JSON responses', async () => {
    const crawler = new Crawler({
      fetchImpl: async () => new Response('{bad', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    await expect(crawler.readUrl('http://93.184.216.34/data.json')).rejects.toMatchObject({
      code: 'invalid_json',
    });
  });

  it('classifies fetch failures as network errors', async () => {
    const crawler = new Crawler({
      fetchImpl: async () => {
        throw new Error('socket failed');
      },
    });

    await expect(crawler.readUrl('http://93.184.216.34')).rejects.toMatchObject({
      code: 'network_error',
    });
  });

  it('does not fetch when the crawler signal is already aborted', async () => {
    let fetchCalled = false;
    const controller = new AbortController();
    controller.abort();
    const crawler = new Crawler({
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response('not used');
      },
    });

    await expect(crawler.readUrl('http://93.184.216.34', {
      signal: controller.signal,
    })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchCalled).toBe(false);
  });

  it('blocks low quality sources before fetching', async () => {
    let fetchCalled = false;
    const crawler = new Crawler({
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response('not used');
      },
    });

    await expect(crawler.readUrl('https://blog.csdn.net/example/article/details/1')).rejects.toMatchObject({
      code: 'blocked_source',
    });
    await expect(crawler.readUrl('https://www.bilibili.com/video/BV123')).rejects.toMatchObject({
      code: 'blocked_source',
    });
    expect(fetchCalled).toBe(false);
  });

  it('transforms GitHub blob URLs to raw content URLs', () => {
    expect(prepareCrawlerUrl('https://github.com/acme/project/blob/main/src/index.ts')).toBe(
      'https://raw.githubusercontent.com/acme/project/main/src/index.ts',
    );
  });

  it('unwraps Bing redirect URLs before reading', () => {
    const targetUrl = 'https://example.com/page';
    const encodedTarget = Buffer.from(targetUrl).toString('base64url');

    expect(prepareCrawlerUrl(`https://www.bing.com/ck/a?u=a1${encodedTarget}`)).toBe(targetUrl);
  });

  it('keeps plain text content unchanged', async () => {
    const codeText = 'const value = input < limit ? input : limit;\n'.repeat(5);
    const crawler = new Crawler({
      fetchImpl: async () => new Response(codeText, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    });

    const page = await crawler.readUrl('http://93.184.216.34/source.ts');

    expect(page.content).toContain('input < limit');
    expect(page.content).toContain('const value');
  });

  it('decodes compressed HTML responses before extracting content', async () => {
    const html = `
      <html>
        <head><title>Compressed Page</title></head>
        <body><main>${'Readable compressed page content. '.repeat(8)}</main></body>
      </html>
    `;
    const crawler = new Crawler({
      fetchImpl: async () => new Response(zlib.gzipSync(html), {
        status: 200,
        headers: {
          'Content-Encoding': 'gzip',
          'Content-Type': 'text/html',
        },
      }),
    });

    const page = await crawler.readUrl('http://93.184.216.34/compressed');

    expect(page.title).toBe('Compressed Page');
    expect(page.content).toContain('Readable compressed page content.');
  });
});
