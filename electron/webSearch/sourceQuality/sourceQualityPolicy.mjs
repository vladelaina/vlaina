import {
  INSTALLED_HARD_BLOCKED_SITES,
  INSTALLED_LOW_PRIORITY_SITES,
  INSTALLED_QUERY_SENSITIVE_BLOCKED_SITES,
} from './installedSourceQualityRules.mjs';
import { MAX_WEB_SEARCH_QUERY_CHARS } from '../types.mjs';

const CONTENT_FARM_SITES = [
  'voidcc.com',
  'codeday.me',
  'voidcn.com',
  'codenong.com',
  'helplib.com',
  'jishuwen.com',
  'itranslater.com',
  'xbuba.com',
  'androidcookie.com',
  'soinside.com',
  '1r1g.com',
  'oomake.com',
];

const DOWNLOAD_RISK_SITES = [
  'pc6.com',
  'onlinedown.net',
  'duote.com',
  'cr173.com',
  'xdowns.com',
  'downza.cn',
  'ddooo.com',
  'greenxf.com',
  'orsoon.com',
  'huajun.com',
  'pconline.com.cn',
  'zol.com.cn',
];

const DOCUMENT_FARM_SITES = [
  'doc88.com',
  'docin.com',
  'book118.com',
  'renrendoc.com',
  'wenku.baidu.com',
  'jingyan.baidu.com',
  'zhidao.baidu.com',
  'diyifanwen.com',
  'ruiwen.com',
  'yuwenmi.com',
  'xuexila.com',
  'liuxue86.com',
  'yjbys.com',
];

const HEALTH_SEO_SITES = [
  '39.net',
  '120ask.com',
  'xywy.com',
  'familydoctor.com.cn',
  'fh21.com.cn',
  'mfk.com',
  'bohe.cn',
  'cndzys.com',
];

export const HARD_BLOCKED_SITES = [
  'zhihu.com',
  'tieba.baidu.com',
  'baidu.com',
  'csdn.net',
  'csdn.com',
  'qq.com',
  '52pojie.cn',
  'toutiao.com',
  '10100.com',
  'open-openai.com',
  'custom-cursor.com',
  'ledger.com.ag',
  'techspot.com',
  'softonic.com',
  'uptodown.com',
  'filehorse.com',
  'malavida.com',
  'download.com',
  'lo4d.com',
  'wallpaperama.com',
  'city-data.com',
  'paypal-community.com',
  'songlanshe.com',
  'douyin.com',
  'moegirl.org.cn',
  'moegirl.uk',
  '3dmgame.com',
  'bitdegree.org',
  'byjus.com',
  'answers.com',
  'brainly.in',
  'hinative.com',
  'nytcrosswordanswers.org',
  'bodhost.com',
  'alien-covenant.com',
  'bluesnews.com',
  'tfw2005.com',
  'geeksforgeeks.org',
  'w3schools.com',
  'owasptopten.org',
  ...CONTENT_FARM_SITES,
  ...DOWNLOAD_RISK_SITES,
  ...INSTALLED_HARD_BLOCKED_SITES,
];

export const QUERY_SENSITIVE_BLOCKED_SITES = {
  documents: [...DOCUMENT_FARM_SITES, ...INSTALLED_QUERY_SENSITIVE_BLOCKED_SITES.documents],
  health: [...HEALTH_SEO_SITES, ...INSTALLED_QUERY_SENSITIVE_BLOCKED_SITES.health],
};

export const LOW_PRIORITY_SITES = [
  'jianshu.com',
  'cnblogs.com',
  '51cto.com',
  'oschina.net',
  'juejin.cn',
  'segmentfault.com',
  'jb51.net',
  'runoob.com',
  'w3cschool.cn',
  'w3school.com.cn',
  'baijiahao.baidu.com',
  'sohu.com',
  'douban.com',
  'xiaohongshu.com',
  ...INSTALLED_LOW_PRIORITY_SITES,
];

const QUERY_SENSITIVE_PATTERNS = [
  {
    sites: QUERY_SENSITIVE_BLOCKED_SITES.health,
    pattern: /\b(health|medical|medicine|drug|symptom|disease|clinic|hospital|vaccine|doctor|treatment|diagnosis|prescription)\b|\u533b\u7597|\u5065\u5eb7|\u75be\u75c5|\u75c7\u72b6|\u533b\u9662|\u533b\u751f|\u836f\u54c1|\u75ab\u82d7|\u6cbb\u7597|\u8bca\u65ad/i,
  },
  {
    sites: QUERY_SENSITIVE_BLOCKED_SITES.documents,
    pattern: /\b(template|essay|resume|sample|document|pdf|contract|paper|homework)\b|\u8303\u6587|\u6a21\u677f|\u7b80\u5386|\u8bba\u6587|\u4f5c\u4e1a|\u5408\u540c|\u6587\u6863|\u8bfe\u4ef6/i,
  },
  {
    sites: LOW_PRIORITY_SITES,
    pattern: /\b(official|documentation|docs|download|install|security|legal|tax|finance|bank|government)\b|\u5b98\u65b9|\u6587\u6863|\u4e0b\u8f7d|\u5b89\u88c5|\u5b89\u5168|\u6cd5\u5f8b|\u7a0e\u52a1|\u91d1\u878d|\u94f6\u884c|\u653f\u5e9c/i,
  },
];

export function uniqueSites(sites) {
  return [...new Set(sites.filter(Boolean))];
}

export function getQuerySensitiveBlockedSites(query) {
  const text = typeof query === 'string' && query.length <= MAX_WEB_SEARCH_QUERY_CHARS ? query : '';
  return uniqueSites(QUERY_SENSITIVE_PATTERNS.flatMap((rule) => rule.pattern.test(text) ? rule.sites : []));
}

export function getExcludedSitesForQuery(query) {
  return uniqueSites([...HARD_BLOCKED_SITES, ...getQuerySensitiveBlockedSites(query)]);
}

export function isHostMatched(hostname, blockedHost) {
  return hostname === blockedHost || hostname.endsWith(`.${blockedHost}`);
}
