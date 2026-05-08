import { describe, expect, it } from 'vitest';
import { LocalSearchProvider, localSearchInternals } from '../electron/webSearch/localSearchProvider.mjs';

describe('LocalSearchProvider quality controls', () => {
  it('filters irrelevant fallback results before trying the next engine', async () => {
    const calls = [];
    const provider = new LocalSearchProvider({
      fetchImpl: async (url) => {
        calls.push(url);
        if (url.startsWith('https://www.google.com/search')) {
          return {
            ok: true,
            async text() {
              return '';
            },
          };
        }
        if (url.startsWith('https://www.bing.com/search')) {
          return {
            ok: true,
            async text() {
              return `
                <li class="b_algo">
                  <h2><a href="https://time.is/Japan">Time in Japan now</a></h2>
                  <div class="b_caption"><p>Exact time now, time zone, and sunrise facts for Japan.</p></div>
                </li>
              `;
            },
          };
        }
        return {
          ok: true,
          async text() {
            return `
              <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Frareproducttimer">RareProductTimer</a>
              <a class="result__snippet">RareProductTimer is a lightweight timer app.</a>
            `;
          },
        };
      },
    });

    await expect(provider.search('rareproducttimer', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'RareProductTimer',
        url: 'https://example.com/rareproducttimer',
        source: 'local-web-search:duckduckgo',
      }),
    ]);
    expect(calls[0]).toMatch(/^https:\/\/www\.google\.com\/search/);
    expect(calls[1]).toMatch(/^https:\/\/www\.bing\.com\/search/);
    expect(calls[2]).toMatch(/^https:\/\/html\.duckduckgo\.com\/html\//);
  });

  it('returns Catime official sources without waiting on external engines', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search should not be called');
      },
    });

    await expect(provider.search('\u4ec0\u4e48\u662fcatime', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Catime - Timer & Pomodoro',
        url: 'https://cati.me/',
      }),
    ]);
    await expect(provider.search('Catime GitHub repository', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Catime - Timer & Pomodoro',
        url: 'https://cati.me/',
      }),
      expect.objectContaining({
        title: 'vladelaina/Catime',
        url: 'https://github.com/vladelaina/Catime',
      }),
    ]);
  });

  it('returns the official WeChat entry before external search can surface clones', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search should not be called');
      },
    });

    await expect(provider.search('wechat pc download official', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'WeChat',
        url: 'https://www.wechat.com/en/',
      }),
    ]);
  });

  it('uses a bounded internal timeout for external search requests', async () => {
    const provider = new LocalSearchProvider({
      timeoutMs: 1,
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
    });

    await expect(provider.search('unknown query without official hint', { limit: 5 })).rejects.toMatchObject({
      code: 'search_unavailable',
    });
  });

  it('keeps low relevance result filtering explicit for catime-like queries', () => {
    expect(localSearchInternals.filterLowRelevanceResults('catime', [
      {
        title: 'Time in Japan now',
        url: 'https://time.is/Japan',
        snippet: 'Exact time now and time zone facts for Japan.',
      },
      {
        title: 'Catime - Timer & Pomodoro',
        url: 'https://cati.me/',
        snippet: 'Catime is a lightweight timer app.',
      },
    ])).toEqual([
      expect.objectContaining({
        title: 'Catime - Timer & Pomodoro',
      }),
    ]);
  });

  it('requires enough meaningful terms to avoid ambiguous Bing-style matches', () => {
    expect(localSearchInternals.getMeaningfulTerms('fish shell official documentation')).toEqual(['fish', 'shell']);
    expect(localSearchInternals.filterLowRelevanceResults('fish shell official documentation', [
      {
        title: 'Oregon Fishing Forum',
        url: 'https://www.oregonfishingforum.com/',
        snippet: 'Fishing reports and local waterbody discussions.',
      },
      {
        title: 'fish shell',
        url: 'https://fishshell.com/docs/current/',
        snippet: 'Official fish shell documentation.',
      },
    ])).toEqual([
      expect.objectContaining({
        title: 'fish shell',
      }),
    ]);
    expect(localSearchInternals.filterLowRelevanceResults('MCP Inspector npm official', [
      {
        title: 'Microsoft MCP certification profile',
        url: 'https://trainingsupport.microsoft.com/en-us/mcp/forum/all/example',
        snippet: 'Certification support forum.',
      },
      {
        title: 'MCP Inspector',
        url: 'https://modelcontextprotocol.io/docs/tools/inspector',
        snippet: 'Inspector documentation for MCP development.',
      },
    ])).toEqual([
      expect.objectContaining({
        title: 'MCP Inspector',
      }),
    ]);
  });

  it('returns official sources for random developer tool queries without external engines', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search should not be called');
      },
    });

    const cases = [
      ['Ghostty terminal official download', 'https://ghostty.org/'],
      ['what is Zed editor official site', 'https://zed.dev/'],
      ['Biome formatter official docs', 'https://biomejs.dev/'],
      ['Rspack official documentation', 'https://rspack.dev/'],
      ['uv Python package manager official docs', 'https://docs.astral.sh/uv/'],
      ['Ruff formatter official docs', 'https://docs.astral.sh/ruff/'],
      ['mise version manager official docs', 'https://mise.jdx.dev/'],
      ['Starship prompt install official', 'https://starship.rs/'],
      ['fish shell official documentation', 'https://fishshell.com/docs/current/'],
      ['OpenCode AI terminal GitHub', 'https://opencode.ai/'],
      ['MCP Inspector npm official', 'https://modelcontextprotocol.io/docs/tools/inspector'],
      ['Ladybird browser official website', 'https://ladybird.org/'],
      ['Python 3.14 release notes official', 'https://docs.python.org/3.14/whatsnew/3.14.html'],
    ];

    for (const [query, url] of cases) {
      await expect(provider.search(query, { limit: 5 }), query).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ url }),
        ]),
      );
    }
  });
});
