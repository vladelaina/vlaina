import { describe, expect, it, vi } from 'vitest';
import { LocalSearchProvider, localSearchInternals } from '../electron/webSearch/localSearchProvider.mjs';

function searchHtmlResponse(html) {
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
}

describe('LocalSearchProvider', () => {
  it('parses Bing result HTML into normalized search results', () => {
    const html = `
      <li class="b_algo">
        <h2><a href="https://example.com/page">Example <strong>Title</strong></a></h2>
        <div class="b_caption"><p>May 6, 2026&ensp;&#0183;&ensp;Example summary.</p></div>
      </li>
    `;

    expect(localSearchInternals.parseBingResults(html, 5)).toEqual([
      {
        title: 'Example Title',
        url: 'https://example.com/page',
        snippet: 'May 6, 2026 · Example summary.',
        publishedAt: 'May 6, 2026',
        source: 'local-web-search:bing',
        thumbnail: null,
      },
    ]);
  });

  it('filters blocked result domains after parsing', () => {
    const html = `
      <li class="b_algo">
        <h2><a href="https://www.zhihu.com/question/1">Blocked Result</a></h2>
        <div class="b_caption"><p>Blocked summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://blog.csdn.net/example/article/details/1">CSDN Result</a></h2>
        <div class="b_caption"><p>Blocked CSDN summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://tieba.baidu.com/p/1">Tieba Result</a></h2>
        <div class="b_caption"><p>Blocked Tieba summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://www.bilibili.com/video/BV123">Bilibili Video</a></h2>
        <div class="b_caption"><p>Blocked video summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="javascript:alert(1)">Script URL</a></h2>
        <div class="b_caption"><p>Blocked script summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="http://127.0.0.1/admin">Loopback URL</a></h2>
        <div class="b_caption"><p>Blocked loopback summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="http://192.168.1.5/router">Private URL</a></h2>
        <div class="b_caption"><p>Blocked private address summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://printer.local/status">Local Host</a></h2>
        <div class="b_caption"><p>Blocked local host summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://ledger.com.ag/download">Fake Ledger</a></h2>
        <div class="b_caption"><p>Blocked fake wallet summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://www.techspot.com/downloads/4718-google-chrome.html">Download Site</a></h2>
        <div class="b_caption"><p>Blocked download site summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://www.city-data.com/city/Clarksville-Tennessee.html">Wrong Stripe Result</a></h2>
        <div class="b_caption"><p>Blocked city-data summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://www.paypal-community.com/t5/Transactions/123">PayPal Community</a></h2>
        <div class="b_caption"><p>Blocked PayPal community summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://nytcrosswordanswers.org/no-exit-playwright-crossword-clue/">Wrong Playwright</a></h2>
        <div class="b_caption"><p>Blocked crossword summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://hinative.com/questions/19819747">Wrong pandas</a></h2>
        <div class="b_caption"><p>Blocked language learning summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://www.bilibili.com/read/cv123">Bilibili Article</a></h2>
        <div class="b_caption"><p>Allowed article summary.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API">Fetch API</a></h2>
        <div class="b_caption"><p>Official summary.</p></div>
      </li>
    `;

    expect(localSearchInternals.parseBingResults(html, 5)).toEqual([
      {
        title: 'Bilibili Article',
        url: 'https://www.bilibili.com/read/cv123',
        snippet: 'Allowed article summary.',
        publishedAt: null,
        source: 'local-web-search:bing',
        thumbnail: null,
      },
      {
        title: 'Fetch API',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
        snippet: 'Official summary.',
        publishedAt: null,
        source: 'local-web-search:bing',
        thumbnail: null,
      },
    ]);
  });

  it('builds search queries without exposing or using Baidu as a provider', () => {
    expect(localSearchInternals.buildSearchQuery('react docs', {})).toContain('-site:csdn.net');
    expect(localSearchInternals.buildSearchQuery('react docs', {})).toContain('-site:tieba.baidu.com');
    expect(localSearchInternals.buildSearchQuery('react docs', {})).toContain('-site:bilibili.com/video');
    expect(localSearchInternals.buildSearchQuery('react docs', {})).toContain('-site:city-data.com');
    expect(localSearchInternals.buildSearchQuery('react docs', {})).toContain('-site:nytcrosswordanswers.org');
  });

  it('maps time ranges to internal search engine parameters', () => {
    expect(localSearchInternals.buildTimeRangeParams('google', 'week')).toEqual({ tbs: 'qdr:w' });
    expect(localSearchInternals.buildTimeRangeParams('bing', 'month')).toEqual({ freshness: 'Month' });
    expect(localSearchInternals.buildTimeRangeParams('duckduckgo', 'day')).toEqual({ df: 'd' });
    expect(localSearchInternals.buildTimeRangeParams('google', 'invalid')).toEqual({});
  });

  it('selects requested search engines while falling back from invalid input', () => {
    expect(localSearchInternals.selectSearchEngines('bing,duckduckgo').map((engine) => engine.id))
      .toEqual(['bing', 'duckduckgo']);
    expect(localSearchInternals.selectSearchEngines(['duckduckgo']).map((engine) => engine.id))
      .toEqual(['duckduckgo']);
    expect(localSearchInternals.selectSearchEngines('unknown').map((engine) => engine.id))
      .toEqual(['google', 'bing', 'duckduckgo']);
  });

  it('runs selected search engines concurrently and merges results by engine priority', async () => {
    const pending = [];
    const fetchImpl = vi.fn((url) => new Promise((resolve) => {
      pending.push({ url, resolve });
    }));
    const provider = new LocalSearchProvider({ fetchImpl, timeoutMs: 5000 });

    const searchPromise = provider.search('needle query', {
      engines: ['bing', 'duckduckgo'],
      limit: 5,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(pending[0].url).toContain('bing.com');
    expect(pending[1].url).toContain('duckduckgo.com');

    pending[1].resolve(new Response(`
      <a class="result__a" href="https://example.com/duck">Needle Query Duck</a>
    `, { status: 200 }));
    pending[0].resolve(new Response(`
      <li class="b_algo">
        <h2><a href="https://example.com/bing">Needle Query Bing</a></h2>
        <div class="b_caption"><p>Needle query summary.</p></div>
      </li>
    `, { status: 200 }));

    await expect(searchPromise).resolves.toEqual([
      expect.objectContaining({
        title: 'Needle Query Bing',
        source: 'local-web-search:bing',
      }),
      expect.objectContaining({
        title: 'Needle Query Duck',
        source: 'local-web-search:duckduckgo',
      }),
    ]);
  });

  it('returns once higher-priority engines fill the limit and cancels slower lower-priority engines', async () => {
    const abortedUrls = [];
    const fetchImpl = vi.fn((url, options = {}) => {
      if (String(url).includes('duckduckgo.com')) {
        options.signal.addEventListener('abort', () => {
          abortedUrls.push(url);
        }, { once: true });
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('cancelled', 'AbortError'));
          }, { once: true });
        });
      }

      return Promise.resolve(new Response(`
        <li class="b_algo">
          <h2><a href="https://example.com/one">Needle Query One</a></h2>
          <div class="b_caption"><p>Needle query first summary.</p></div>
        </li>
        <li class="b_algo">
          <h2><a href="https://example.com/two">Needle Query Two</a></h2>
          <div class="b_caption"><p>Needle query second summary.</p></div>
        </li>
      `, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }));
    });
    const provider = new LocalSearchProvider({ fetchImpl, timeoutMs: 5000 });

    await expect(provider.search('needle query', {
      engines: ['bing', 'duckduckgo'],
      limit: 2,
    })).resolves.toEqual([
      expect.objectContaining({
        title: 'Needle Query One',
        source: 'local-web-search:bing',
      }),
      expect.objectContaining({
        title: 'Needle Query Two',
        source: 'local-web-search:bing',
      }),
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(abortedUrls).toHaveLength(1);
    expect(abortedUrls[0]).toContain('duckduckgo.com');
  });

  it('returns strong fresh official hints after a bounded grace when supplemental engines stall', async () => {
    vi.useFakeTimers();
    try {
      const abortedUrls = [];
      const fetchImpl = vi.fn((url, options = {}) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          abortedUrls.push(String(url));
          reject(new DOMException('cancelled', 'AbortError'));
        }, { once: true });
      }));
      const provider = new LocalSearchProvider({
        fetchImpl,
        timeoutMs: 5000,
        officialHintGraceMs: 25,
      });

      const request = provider.search('latest IRS tax inflation adjustments 2026 official', { limit: 5 });
      let settled = false;
      void request.finally(() => {
        settled = true;
      });

      expect(fetchImpl).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(24);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(request).resolves.toEqual([
        expect.objectContaining({
          title: 'IRS Tax Inflation Adjustments for Tax Year 2026',
          url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
        }),
      ]);
      await Promise.resolve();

      expect(abortedUrls).toEqual(expect.arrayContaining([
        expect.stringMatching(/^https:\/\/www\.google\.com\/search/),
        expect.stringMatching(/^https:\/\/www\.bing\.com\/search/),
        expect.stringMatching(/^https:\/\/html\.duckduckgo\.com\/html\//),
      ]));
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns empty results after a bounded grace when only higher-priority engines are still stalled', async () => {
    vi.useFakeTimers();
    try {
      const abortedUrls = [];
      const fetchImpl = vi.fn((url, options = {}) => {
        const textUrl = String(url);
        if (textUrl.includes('google.com')) {
          options.signal.addEventListener('abort', () => {
            abortedUrls.push(textUrl);
          }, { once: true });
          return new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => {
              reject(new DOMException('cancelled', 'AbortError'));
            }, { once: true });
          });
        }

        return Promise.resolve(new Response(`
          <li class="b_algo">
            <h2><a href="https://weather.com/us/washington/city/seattle/tenday">10-Day Weather Forecast for Seattle</a></h2>
            <div class="b_caption"><p>Seattle weather forecast and conditions.</p></div>
          </li>
        `, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }));
      });
      const provider = new LocalSearchProvider({
        fetchImpl,
        timeoutMs: 5000,
        engineFallbackGraceMs: 25,
      });

      const request = provider.search('weather in shanghai today', {
        engines: ['google', 'bing'],
        limit: 5,
      });
      let settled = false;
      void request.finally(() => {
        settled = true;
      });

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(24);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(request).resolves.toEqual([]);

      expect(abortedUrls).toHaveLength(1);
      expect(abortedUrls[0]).toContain('google.com');
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels search result body reads when the external signal aborts', async () => {
    const controller = new AbortController();
    const reader = {
      read: vi.fn(() => new Promise(() => undefined)),
      cancel: vi.fn(async () => undefined),
      releaseLock: vi.fn(),
    };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      body: {
        getReader: () => reader,
      },
    }));
    const provider = new LocalSearchProvider({ fetchImpl, timeoutMs: 5000 });

    const request = provider.search('needle query', {
      engines: ['bing'],
      limit: 5,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(reader.read).toHaveBeenCalled());
    controller.abort();

    await expect(request).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(reader.cancel).toHaveBeenCalledTimes(1);
    expect(reader.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('bounds oversized search engine response bodies', async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('x'.repeat(1_000_001)));
        },
        cancel,
      }),
      {
        status: 200,
        headers: { 'content-type': 'text/html' },
      },
    );
    const provider = new LocalSearchProvider({
      fetchImpl: async () => response,
    });

    await expect(provider.search('needle query', {
      engines: ['bing'],
      limit: 5,
    })).rejects.toMatchObject({
      code: 'search_unavailable',
      cause: expect.objectContaining({ code: 'response_too_large' }),
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => response.body?.getReader()).not.toThrow();
  });

  it('rejects search engine fetches promptly when the fetch implementation ignores cancellation', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(() => new Promise(() => undefined));
    const provider = new LocalSearchProvider({ fetchImpl, timeoutMs: 5000 });

    const request = provider.search('needle query', {
      engines: ['bing'],
      limit: 5,
      signal: controller.signal,
    });
    request.catch(() => undefined);

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    controller.abort();

    await expect(request).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects direct official lookup results that resolve after cancellation', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (url) => {
      if (url === 'https://xqstale.com/') {
        controller.abort();
        return new Response('<title>XQStale</title>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }

      return new Response('', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    });
    const provider = new LocalSearchProvider({ fetchImpl, timeoutMs: 5000 });

    await expect(provider.search('xqstale official', {
      engines: ['bing'],
      limit: 5,
      signal: controller.signal,
    })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('cancels the direct official lookup after search engines return usable results', async () => {
    const abortedUrls = [];
    const fetchImpl = vi.fn((url, options = {}) => {
      if (url === 'https://xqtimer.com/') {
        options.signal.addEventListener('abort', () => {
          abortedUrls.push(url);
        }, { once: true });
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('cancelled', 'AbortError'));
          }, { once: true });
        });
      }

      return Promise.resolve(new Response(`
        <li class="b_algo">
          <h2><a href="https://example.com/xqtimer">XQTimer official release notes</a></h2>
          <div class="b_caption"><p>XQTimer official update summary.</p></div>
        </li>
      `, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }));
    });
    const provider = new LocalSearchProvider({ fetchImpl, timeoutMs: 5000 });

    await expect(provider.search('xqtimer official', {
      engines: ['bing'],
      limit: 5,
    })).resolves.toEqual([
      expect.objectContaining({
        title: 'XQTimer official release notes',
        source: 'local-web-search:bing',
      }),
    ]);

    expect(fetchImpl).toHaveBeenCalledWith('https://xqtimer.com/', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(abortedUrls).toEqual(['https://xqtimer.com/']);
  });

  it('cancels direct official lookup fetches even when they ignore cancellation', async () => {
    const fetchImpl = vi.fn((url) => {
      if (url === 'https://xqwait.com/') {
        return new Promise(() => undefined);
      }

      return Promise.resolve(new Response(`
        <li class="b_algo">
          <h2><a href="https://example.com/xqwait">XQWait official docs</a></h2>
          <div class="b_caption"><p>XQWait official docs summary.</p></div>
        </li>
      `, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }));
    });
    const provider = new LocalSearchProvider({ fetchImpl, timeoutMs: 5000 });

    await expect(provider.search('xqwait official', {
      engines: ['bing'],
      limit: 5,
    })).resolves.toEqual([
      expect.objectContaining({
        title: 'XQWait official docs',
        source: 'local-web-search:bing',
      }),
    ]);

    expect(fetchImpl).toHaveBeenCalledWith('https://xqwait.com/', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it('parses Google and DuckDuckGo result links', () => {
    const googleHtml = `
      <a href="/url?q=https%3A%2F%2Fexample.com%2Fgoogle&sa=U"><h3>Google Result</h3></a>
      <p>Unrelated paragraph text.</p>
      <div class="VwiC3b">Google summary text.</div>
    `;
    const duckHtml = `
      <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fduck">Duck Result</a>
      <p>Unrelated paragraph text.</p>
      <a class="result__snippet">Duck summary text.</a>
    `;

    expect(localSearchInternals.parseGoogleResults(googleHtml, 5)).toEqual([
      expect.objectContaining({
        title: 'Google Result',
        url: 'https://example.com/google',
        snippet: 'Google summary text.',
        source: 'local-web-search:google',
      }),
    ]);
    expect(localSearchInternals.parseDuckDuckGoResults(duckHtml, 5)).toEqual([
      expect.objectContaining({
        title: 'Duck Result',
        url: 'https://example.com/duck',
        snippet: 'Duck summary text.',
        source: 'local-web-search:duckduckgo',
      }),
    ]);
  });

  it('adds official source hints for common technical documentation queries', () => {
    expect(localSearchInternals.buildOfficialSourceHints('MDN Fetch API')).toEqual([
      expect.objectContaining({
        title: 'Fetch API - MDN Web Docs',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
      }),
    ]);

    expect(localSearchInternals.buildOfficialSourceHints('Python requests documentation')).toEqual([
      expect.objectContaining({
        title: 'Requests: HTTP for Humans',
        url: 'https://requests.readthedocs.io/en/latest/',
      }),
      expect.objectContaining({
        title: 'Python Documentation',
        url: 'https://www.python.org/doc/',
      }),
    ]);

    expect(localSearchInternals.buildOfficialSourceHints('SQLite UPSERT syntax official')).toEqual([
      expect.objectContaining({
        title: 'SQLite UPSERT',
        url: 'https://www.sqlite.org/lang_upsert.html',
      }),
      expect.objectContaining({
        title: 'SQLite Query Language',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('Rust ownership official')).toEqual([
      expect.objectContaining({
        title: 'What Is Ownership? - The Rust Programming Language',
        url: 'https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('React useEffect tutorial CSDN Zhihu')).toEqual([
      expect.objectContaining({
        title: 'useEffect - React',
        url: 'https://react.dev/reference/react/useEffect',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('Next.js 16 official release blog')).toEqual([
      expect.objectContaining({
        title: 'Next.js 16',
        url: 'https://nextjs.org/blog/next-16',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('Vite 7 official release blog')).toEqual([
      expect.objectContaining({
        title: 'Vite 7.0 is out!',
        url: 'https://vite.dev/blog/announcing-vite7',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('Tailwind CSS v4 official release blog')).toEqual([
      expect.objectContaining({
        title: 'Tailwind CSS v4.0',
        url: 'https://tailwindcss.com/blog/tailwindcss-v4',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('Cursor download free crack')).toEqual([
      expect.objectContaining({
        title: 'Download Cursor',
        url: 'https://cursor.com/download/',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('ChatGPT official login')).toEqual([
      expect.objectContaining({
        title: 'ChatGPT Login',
        url: 'https://chatgpt.com/auth/login',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('OpenAI API documentation official')).toEqual([
      expect.objectContaining({
        title: 'OpenAI API Documentation',
        url: 'https://platform.openai.com/docs',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('GitHub Desktop official download')).toEqual([
      expect.objectContaining({
        title: 'GitHub Desktop',
        url: 'https://desktop.github.com/download/',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('Cursor official download')).toEqual([
      expect.objectContaining({
        title: 'Download Cursor',
        url: 'https://cursor.com/download/',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('OpenAI API documentation')).toEqual([
      expect.objectContaining({
        title: 'OpenAI API Documentation',
        url: 'https://platform.openai.com/docs',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('ChatGPT sign in')).toEqual([
      expect.objectContaining({
        title: 'ChatGPT Login',
        url: 'https://chatgpt.com/auth/login',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('Ledger Live download seed phrase')).toEqual([
      expect.objectContaining({
        title: 'Ledger Live',
        url: 'https://www.ledger.com/ledger-live',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('US passport renewal official')).toEqual([
      expect.objectContaining({
        title: 'Renew my Passport Online',
        url: 'https://travel.state.gov/content/travel/en/passports/have-passport/renew-online.html',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('CDC flu vaccine official')).toEqual([
      expect.objectContaining({
        title: 'Flu Vaccines',
        url: 'https://www.cdc.gov/flu/vaccines/index.html',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('IRS tax brackets 2026 official')).toEqual([
      expect.objectContaining({
        title: 'IRS Tax Inflation Adjustments for Tax Year 2026',
        url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
      }),
    ]);
    expect(localSearchInternals.buildOfficialSourceHints('MetaMask official download extension')).toEqual([
      expect.objectContaining({
        title: 'Download MetaMask',
        url: 'https://metamask.io/download/',
      }),
    ]);
  });

  it('can require stronger query matching for supplemental results', () => {
    const html = `
      <li class="b_algo">
        <h2><a href="https://rust.facepunch.com/">Rust Game</a></h2>
        <div class="b_caption"><p>Survive on an island.</p></div>
      </li>
      <li class="b_algo">
        <h2><a href="https://www.rust-lang.org/">Rust Programming Language</a></h2>
        <div class="b_caption"><p>Rust language documentation.</p></div>
      </li>
    `;

    expect(localSearchInternals.parseBingResults(html, 5, new Set(), {
      query: 'Rust programming language book',
      minQueryScore: 2,
    })).toEqual([
      expect.objectContaining({
        title: 'Rust Programming Language',
        url: 'https://www.rust-lang.org/',
      }),
    ]);
  });

  it('is always internally configured', () => {
    expect(new LocalSearchProvider().isConfigured()).toBe(true);
  });

  it('tries Google before falling back to Bing', async () => {
    const calls = [];
    const provider = new LocalSearchProvider({
      fetchImpl: async (url) => {
        calls.push(url);
        if (url.startsWith('https://www.google.com/search')) {
          throw new Error('google unavailable');
        }
        return searchHtmlResponse(`
              <li class="b_algo">
                <h2><a href="https://example.com/bing">Bing Fallback</a></h2>
                <div class="b_caption"><p>Fallback summary.</p></div>
              </li>
            `);
      },
    });

    await expect(provider.search('bing fallback query', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Bing Fallback',
        url: 'https://example.com/bing',
        source: 'local-web-search:bing',
      }),
    ]);
    expect(calls[0]).toMatch(/^https:\/\/www\.google\.com\/search/);
    expect(calls[1]).toMatch(/^https:\/\/www\.bing\.com\/search/);
    expect(calls.some((url) => url.startsWith('https://www.baidu.com'))).toBe(false);
  });

  it('keeps Google priority when concurrent fallback engines are also queried', async () => {
    const calls = [];
    const provider = new LocalSearchProvider({
      fetchImpl: async (url) => {
        calls.push(url);
        return searchHtmlResponse('<a href="/url?q=https%3A%2F%2Fexample.com%2Fgoogle"><h3>Google First</h3></a>');
      },
    });

    await expect(provider.search('google first query', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Google First',
        url: 'https://example.com/google',
        source: 'local-web-search:google',
      }),
    ]);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatch(/^https:\/\/www\.google\.com\/search/);
    expect(calls[1]).toMatch(/^https:\/\/www\.bing\.com\/search/);
    expect(calls[2]).toMatch(/^https:\/\/html\.duckduckgo\.com\/html\//);
  });

  it('falls back to official source hints when live search engines fail', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search unavailable');
      },
    });

    await expect(provider.search('SQLite UPSERT syntax official', { timeRange: 'week', limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'SQLite UPSERT',
        url: 'https://www.sqlite.org/lang_upsert.html',
      }),
      expect.objectContaining({
        title: 'SQLite Query Language',
      }),
    ]);
  });

  it('uses official source hints as pinned results while still accepting live search results', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => searchHtmlResponse(`
            <li class="b_algo">
              <h2><a href="https://example.com/sqlite-upsert-news">SQLite UPSERT official syntax update</a></h2>
              <div class="b_caption"><p>SQLite UPSERT syntax official supplemental source.</p></div>
            </li>
          `),
    });

    await expect(provider.search('SQLite UPSERT syntax official', { engines: ['bing'], timeRange: 'week', limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'SQLite UPSERT',
        url: 'https://www.sqlite.org/lang_upsert.html',
      }),
      expect.objectContaining({
        title: 'SQLite Query Language',
      }),
      expect.objectContaining({
        title: 'SQLite UPSERT official syntax update',
        url: 'https://example.com/sqlite-upsert-news',
      }),
    ]);
  });

  it('does not short-circuit fresh official queries before checking live search results', async () => {
    const calls = [];
    const provider = new LocalSearchProvider({
      fetchImpl: async (url) => {
        calls.push(url);
        return searchHtmlResponse(`
              <li class="b_algo">
                <h2><a href="https://example.com/latest-openai-api">OpenAI API documentation recent update official</a></h2>
                <div class="b_caption"><p>Recent OpenAI API documentation official update.</p></div>
              </li>
            `);
      },
    });

    await expect(provider.search('OpenAI API documentation recent official', { engines: ['bing'], limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'OpenAI API Documentation',
        url: 'https://platform.openai.com/docs',
      }),
      expect.objectContaining({
        title: 'OpenAI API documentation recent update official',
        url: 'https://example.com/latest-openai-api',
      }),
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^https:\/\/www\.bing\.com\/search/);
  });

  it('treats Chinese freshness wording as a live-search request', async () => {
    const calls = [];
    const provider = new LocalSearchProvider({
      fetchImpl: async (url) => {
        calls.push(url);
        return searchHtmlResponse(`
              <li class="b_algo">
                <h2><a href="https://example.com/openai-api-update-cn">OpenAI API 官方文档 最新更新</a></h2>
                <div class="b_caption"><p>OpenAI API documentation official update.</p></div>
              </li>
            `);
      },
    });

    await expect(provider.search('OpenAI API 官方文档 最新更新', { engines: ['bing'], limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'OpenAI API Documentation',
        url: 'https://platform.openai.com/docs',
      }),
      expect.objectContaining({
        title: 'OpenAI API 官方文档 最新更新',
        url: 'https://example.com/openai-api-update-cn',
      }),
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^https:\/\/www\.bing\.com\/search/);
  });

  it('keeps stable Chinese official queries on the no-network fast path', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search should not be called');
      },
    });

    await expect(provider.search('OpenAI API 官方文档', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'OpenAI API Documentation',
        url: 'https://platform.openai.com/docs',
      }),
    ]);
  });

  it('returns high-risk official hints without waiting on external engines', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search should not be called');
      },
    });

    await expect(provider.search('Trezor Suite seed phrase download', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Trezor Suite',
        url: 'https://trezor.io/trezor-suite',
      }),
    ]);
    await expect(provider.search('Stripe secret key exposed what to do official', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Stripe API Reference',
        url: 'https://docs.stripe.com/api',
      }),
    ]);
    await expect(provider.search('React Router docs official', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'React Router Docs',
        url: 'https://reactrouter.com/home',
      }),
    ]);
    await expect(provider.search('Prisma documentation official', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Prisma Documentation',
        url: 'https://www.prisma.io/docs',
      }),
    ]);
  });

  it('returns common official hints without waiting on external engines', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search should not be called');
      },
    });

    await expect(provider.search('PyTorch install CUDA wheel download', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Start Locally - PyTorch',
        url: 'https://pytorch.org/get-started/locally/',
      }),
    ]);
    await expect(provider.search('Homebrew install CSDN tutorial', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Homebrew',
        url: 'https://brew.sh/',
      }),
    ]);
    await expect(provider.search('pandas read_csv official docs', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'pandas.read_csv',
        url: 'https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html',
      }),
    ]);
    await expect(provider.search('California REAL ID official DMV', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'REAL ID - California DMV',
        url: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/real-id/',
      }),
    ]);
    await expect(provider.search('VLC media player download official no ads', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'VLC media player',
        url: 'https://www.videolan.org/vlc/',
      }),
    ]);
    await expect(provider.search('OpenSSL 3.5.4 release notes official', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'OpenSSL 3.5 Series Release Notes',
        url: 'https://openssl-library.org/news/openssl-3.5-notes/',
      }),
    ]);
    await expect(provider.search('WHO mpox latest outbreak 2026 official', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'WHO mpox external situation report #65',
        url: 'https://www.who.int/publications/m/item/multi-country-outbreak-of-mpox--external-situation-report--65---30-april-2026',
      }),
    ]);
    await expect(provider.search('Rust edition 2024 guide official', { limit: 5 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Rust 2024 Edition Guide',
        url: 'https://doc.rust-lang.org/edition-guide/rust-2024/index.html',
      }),
    ]);
    await expect(provider.search('SQLite jsonb documentation official', { limit: 5 })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'SQLite JSON Functions and Operators',
          url: 'https://www.sqlite.org/json1.html',
        }),
      ]),
    );
    await expect(provider.search('NVIDIA RTX 5090 specifications official', { limit: 5 })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'GeForce RTX 5090',
          url: 'https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/',
        }),
      ]),
    );
  });
});
