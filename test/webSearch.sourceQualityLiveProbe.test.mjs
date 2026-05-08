import { describe, expect, it } from 'vitest';
import { localSearchInternals } from '../electron/webSearch/localSearchProvider.mjs';

describe('source quality live-probe regressions', () => {
  it('blocks fake WeChat-like official download results', () => {
    const html = `
      <li class="b_algo">
        <h2><a href="https://www.inivite-wechat.com/en/">WeChat Download</a></h2>
        <p>Unofficial download page.</p>
      </li>
      <li class="b_algo">
        <h2><a href="https://www.wechat.com/en/">WeChat</a></h2>
        <p>Official WeChat site.</p>
      </li>
    `;

    expect(localSearchInternals.parseBingResults(html, 5, new Set(), {
      query: 'wechat pc download official',
    })).toEqual([
      expect.objectContaining({ url: 'https://www.wechat.com/en/' }),
    ]);
  });
});
