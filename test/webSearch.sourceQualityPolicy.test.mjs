import { describe, expect, it } from 'vitest';
import {
  HARD_BLOCKED_SITES,
  LOW_PRIORITY_SITES,
  QUERY_SENSITIVE_BLOCKED_SITES,
  getExcludedSitesForQuery,
  getQuerySensitiveBlockedSites,
  isHostMatched,
} from '../electron/webSearch/sourceQualityPolicy.mjs';
import { buildPackageRegistrySourceHints } from '../electron/webSearch/packageRegistrySourceHints.mjs';
import { MAX_WEB_SEARCH_QUERY_CHARS } from '../electron/webSearch/types.mjs';
import { localSearchInternals } from '../electron/webSearch/localSearchProvider.mjs';

describe('source quality policy', () => {
  it('keeps the global hard block list focused on known low-quality sources', () => {
    expect(HARD_BLOCKED_SITES).toEqual(expect.arrayContaining([
      'csdn.net',
      'zhihu.com',
      'baidu.com',
      'voidcc.com',
      'codenong.com',
      'stackoom.com',
      'it1352.com',
      'pc6.com',
      'onlinedown.net',
      'huajun.com',
      'downxia.com',
      'inivite-wechat.com',
    ]));
    expect(LOW_PRIORITY_SITES).toEqual(expect.arrayContaining([
      'jianshu.com',
      'cnblogs.com',
      'juejin.cn',
      'segmentfault.com',
    ]));
  });

  it('adds sensitive blocks only for matching query classes', () => {
    expect(getQuerySensitiveBlockedSites('vaccine side effects medical guidance')).toEqual(
      expect.arrayContaining(['39.net', '120ask.com', 'xywy.com', 'haodf.com']),
    );
    expect(getQuerySensitiveBlockedSites('resume template document sample')).toEqual(
      expect.arrayContaining(['doc88.com', 'docin.com', 'wenku.baidu.com', 'taodocs.com']),
    );
    expect(getQuerySensitiveBlockedSites('React official documentation')).toEqual(
      expect.arrayContaining(['jianshu.com', 'cnblogs.com', 'juejin.cn']),
    );
    expect(getQuerySensitiveBlockedSites('funny weekend ideas')).toEqual([]);
  });

  it('does not coerce or scan overlong source-quality queries', () => {
    const hostileQuery = {
      toString() {
        throw new Error('query should not be coerced');
      },
    };
    const overlongQuery = `${' '.repeat(MAX_WEB_SEARCH_QUERY_CHARS + 1)}React official documentation`;

    expect(getQuerySensitiveBlockedSites(hostileQuery)).toEqual([]);
    expect(getQuerySensitiveBlockedSites(overlongQuery)).toEqual([]);
    expect(buildPackageRegistrySourceHints(hostileQuery)).toEqual([]);
    expect(buildPackageRegistrySourceHints(overlongQuery)).toEqual([]);
  });

  it('uses query-sensitive sites in search exclusions and result filtering', () => {
    const healthQuery = localSearchInternals.buildSearchQuery('vaccine medical guidance', {});
    const officialQuery = localSearchInternals.buildSearchQuery('React official documentation', {});

    expect(healthQuery).toContain('-site:39.net');
    expect(healthQuery).toContain('-site:120ask.com');
    expect(healthQuery).toContain('-site:haodf.com');
    expect(officialQuery).toContain('-site:juejin.cn');
    expect(officialQuery).toContain('-site:cnblogs.com');

    const html = `
      <li class="b_algo"><h2><a href="https://ask.39.net/question/1">Health SEO</a></h2><p>Bad.</p></li>
      <li class="b_algo"><h2><a href="https://haodf.com/doctor/1">Medical Q and A</a></h2><p>Bad.</p></li>
      <li class="b_algo"><h2><a href="https://www.cdc.gov/vaccines/">CDC</a></h2><p>Good.</p></li>
    `;

    expect(localSearchInternals.parseBingResults(html, 5, new Set(), { query: 'vaccine medical guidance' })).toEqual([
      expect.objectContaining({ url: 'https://www.cdc.gov/vaccines/' }),
    ]);
  });

  it('matches exact hosts and subdomains only', () => {
    expect(isHostMatched('blog.csdn.net', 'csdn.net')).toBe(true);
    expect(isHostMatched('csdn.net.example.com', 'csdn.net')).toBe(false);
    expect(getExcludedSitesForQuery('official docs')).toEqual(expect.arrayContaining(LOW_PRIORITY_SITES));
    expect(getExcludedSitesForQuery('casual dinner ideas')).not.toEqual(expect.arrayContaining(LOW_PRIORITY_SITES));
    expect(QUERY_SENSITIVE_BLOCKED_SITES.health).toContain('xywy.com');
  });
});
