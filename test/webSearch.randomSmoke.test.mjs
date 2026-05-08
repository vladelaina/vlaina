import { describe, expect, it } from 'vitest';
import { LocalSearchProvider, localSearchInternals } from '../electron/webSearch/localSearchProvider.mjs';
import { SearchService } from '../electron/webSearch/searchService.mjs';

const smokeCases = [
  ['catime', 'what is catime', 'https://cati.me/'],
  ['wechat', 'wechat pc download official', 'https://www.wechat.com/en/'],
  ['python', 'Python download official', 'https://www.python.org/downloads/'],
  ['w4', 'IRS W-4 form official', 'https://www.irs.gov/forms-pubs/about-form-w-4'],
  ['poison', 'Poison Control phone number official', 'https://www.poison.org/'],
  ['github-cli', 'GitHub CLI download official', 'https://cli.github.com/'],
  ['credit-report', 'Free credit report official', 'https://www.annualcreditreport.com/'],
  ['vote', 'Register to vote official', 'https://vote.gov/'],
  ['zip-code', 'USPS ZIP code lookup official', 'https://tools.usps.com/zip-code-lookup.htm'],
  ['cisa-passwords', 'CISA passwords official', 'https://www.cisa.gov/secure-our-world/use-strong-passwords'],
  ['fcc-broadband', 'FCC broadband map official', 'https://broadbandmap.fcc.gov/'],
  ['car-recall', 'NHTSA car recall official', 'https://www.nhtsa.gov/recalls'],
];

function makeSeededIndexes(total, count, seed) {
  const indexes = Array.from({ length: total }, (_, index) => index);
  let state = seed;
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const swapIndex = state % (index + 1);
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes.slice(0, count);
}

describe('random web search smoke coverage', () => {
  it('keeps seeded user-style queries on official zero-network results', async () => {
    const provider = new LocalSearchProvider({
      fetchImpl: async () => {
        throw new Error('external search should not be called for official smoke cases');
      },
    });
    const selectedCases = makeSeededIndexes(smokeCases.length, 8, 20260508)
      .map((index) => smokeCases[index]);

    for (const [name, query, expectedUrl] of selectedCases) {
      const response = await new SearchService({ providers: [provider] }).webSearch(query, { limit: 5 });
      expect(response.results[0]?.url, name).toBe(expectedUrl);
    }
  });

  it('keeps random low-quality and unsafe fixture results out of parsed search results', () => {
    const blockedFixtures = [
      ['csdn', 'https://blog.csdn.net/example/article/details/1'],
      ['zhihu', 'https://www.zhihu.com/question/1'],
      ['tieba', 'https://tieba.baidu.com/p/1'],
      ['fake-wechat', 'https://www.inivite-wechat.com/en/'],
      ['bilibili-video', 'https://www.bilibili.com/video/BV1xx411c7mD'],
      ['private-ip', 'http://192.168.1.2/admin'],
    ];
    const selectedFixtures = makeSeededIndexes(blockedFixtures.length, 4, 424242)
      .map((index) => blockedFixtures[index]);
    const html = `
      ${selectedFixtures.map(([name, url]) => `
        <li class="b_algo"><h2><a href="${url}">${name}</a></h2><p>Low-quality or unsafe result.</p></li>
      `).join('\n')}
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
