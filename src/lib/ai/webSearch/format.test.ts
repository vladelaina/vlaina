import { describe, expect, it } from 'vitest';
import { formatBatchPagesForModel, formatSearchResultsForModel } from './format';

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
      },
    ]);

    expect(text).toContain('Page 1: success');
    expect(text).toContain('Readable content');
    expect(text).toContain('Page 2: failed');
    expect(text).toContain('Unable to read this page.');
    expect(text).not.toContain('HTTP 404');
  });
});
