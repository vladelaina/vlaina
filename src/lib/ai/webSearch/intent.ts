export type WebSearchIntent =
  | { action: 'answer-capability' }
  | { action: 'prefetch'; query: string; reason: 'explicit-search' | 'fresh-info' }
  | { action: 'decide' };

const MAX_INTENT_SEARCH_QUERY_CHARS = 1000;
const ZERO_WIDTH_CHARS_RE = /[\u200b-\u200f\ufeff]/g;

const CHINESE_CAPABILITY_RE =
  /(?:你|你们|助手|模型|ai|当前聊天|这个聊天)?[^。？！?\n]{0,12}(?:能不能|可不可以|可以|能|会不会|会|支持|有没有|是否)[^。？！?\n]{0,12}(?:联网|上网|网络|互联网|网页|搜索|查询|搜|web\s*search|web\s*access|browse|internet|online)/i;
const CHINESE_REVERSE_CAPABILITY_RE =
  /(?:联网|上网|网络|互联网|网页|搜索|查询|搜|web\s*search|web\s*access|browse|internet|online)[^。？！?\n]{0,12}(?:功能|能力)?[^。？！?\n]{0,12}(?:吗|么|不|是否|能不能|可以不|可不可以|\?)/i;
const ENGLISH_CAPABILITY_RE =
  /\b(?:can|could|are you able to|do you|do u|can u|support|have)\b[\s\S]{0,48}\b(?:web search|search the web|browse|internet|online|web access)\b/i;
const MULTILINGUAL_CAPABILITY_RE =
  /(?:puedes|puede|pouvez|peux|kannst du|können sie|puoi|pode|можешь|можете|できます|できる|할 수|가능|تستطيع|يمكنك)[\s\S]{0,48}(?:internet|web|online|buscar|búsqueda|recherche|suche|suchen|cercare|pesquisar|искать|интернет|интернете|веб|поиск|検索|인터넷|웹|검색|الإنترنت|ويب|بحث)/i;
const MULTILINGUAL_REVERSE_CAPABILITY_RE =
  /(?:internet|web|online|buscar|búsqueda|recherche|suche|suchen|cercare|pesquisar|искать|интернет|интернете|веб|поиск|検索|인터넷|웹|검색|الإنترنت|ويب|بحث)[\s\S]{0,48}(?:puedes|puede|pouvez|peux|kannst du|können sie|puoi|pode|можешь|можете|できます|できる|할 수|가능|تستطيع|يمكنك|\?)/i;
const MULTILINGUAL_GENERIC_CAPABILITY_RE =
  /^(?:[¿¡\s]*|هل\s*)?(?:(?:puedes|puede|pouvez|peux|kannst du|können sie|puoi|pode|можешь|можете|できます|できる|할 수|가능|تستطيع|يمكنك)[\s\S]{0,48}(?:internet|web|online|buscar|búsqueda|recherche|suche|suchen|cercare|pesquisar|искать|интернет|интернете|веб|поиск|検索|인터넷|웹|검색|الإنترنت|ويب|بحث)|(?:internet|web|online|buscar|búsqueda|recherche|suche|suchen|cercare|pesquisar|искать|интернет|интернете|веб|поиск|検索|인터넷|웹|검색|الإنترنت|ويب|بحث)[\s\S]{0,48}(?:puedes|puede|pouvez|peux|kannst du|können sie|puoi|pode|можешь|можете|できます|できる|할 수|가능|تستطيع|يمكنك|\?))(?:[\s?？؟!！.。]*)$/i;

const EXPLICIT_SEARCH_RE =
  /(?:搜一下|搜索一下|搜搜|联网(?:搜索|查询|搜|查)|上网(?:搜索|查询|搜|查)|\b(?:can you|could you|please|pls|help me)\s+(?:search|google|look up|lookup|browse|find online|find on the web)\b|\b(?:search|google)\s+(?:for|about)\b|\b(?:look up|lookup|search the web|web search|browse the web|find online|find on the web)\b)/i;
const FRESHNESS_RE =
  /(?:今天|今日|现在|当前|目前|实时|最新|近期|最近|刚刚|今年|本周|这周|本月|这个月|\b(?:today|now|current|currently|latest|recent|real[-\s]?time|this week|this month|this year|as of)\b)/i;
const LIVE_DATA_RE =
  /(?:金价|银价|油价|价格|报价|汇率|股价|股票|基金|期货|指数|天气|气温|新闻|消息|热搜|榜单|票房|航班|火车|高铁|路况|政策|法规|公告|发布|更新|版本|比赛|赛程|比分|利率|房价|\b(?:price|prices|gold|silver|oil|exchange rate|stock|stocks|share price|weather|forecast|news|headline|release|version|update|policy|law|announcement|flight|train|traffic|score|fixture|interest rate|market)\b)/i;

function normalizeIntentText(text: string): string {
  return text.normalize('NFKC').replace(ZERO_WIDTH_CHARS_RE, '').trim();
}

function hasWebSearchCapabilityQuestion(text: string): boolean {
  return CHINESE_CAPABILITY_RE.test(text)
    || CHINESE_REVERSE_CAPABILITY_RE.test(text)
    || ENGLISH_CAPABILITY_RE.test(text)
    || MULTILINGUAL_CAPABILITY_RE.test(text)
    || MULTILINGUAL_REVERSE_CAPABILITY_RE.test(text);
}

function hasFreshInfoNeed(text: string): boolean {
  return FRESHNESS_RE.test(text) && LIVE_DATA_RE.test(text);
}

function isGenericCapabilityQuery(query: string): boolean {
  const normalized = query.replace(/\s+/g, '');
  if (!normalized) return true;
  return normalized.replace(/(?:功能|能力|资料|信息|内容|东西|问题|结果|网页|有|没有|可以|能|不能|查|搜)/g, '').length === 0;
}

function cleanSearchQuery(text: string): string {
  return normalizeIntentText(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b(?:please|can you|could you|would you|are you able to|do you have|do you support|do you|help me|also|then|for|about)\b/gi, ' ')
    .replace(/\b(?:search the web|web search|search|lookup|look up|google|browse|find online|find on the web)\b/gi, ' ')
    .replace(/\b(?:the\s+)?(?:internet|web|online)(?:\s+access)?\b/gi, ' ')
    .replace(/(?:你们|你)?(?:能不能|可不可以|可以|能否|能|会不会|会|支持|有没有|是否)[^。？！?\n]{0,6}(?:联网|上网|网络|互联网|网页|搜索|查询|搜|web\s*search|web\s*access|browse|internet|online)/gi, ' ')
    .replace(/(?:联网|上网)(?:搜索|查询|搜|查)|(?:搜索一下|搜一下|查一下|搜搜|搜索|查询|查找|检索)/g, ' ')
    .replace(/(^|[\s?？!！。.,，;；:：])(?:搜|查)(?=\S)/g, '$1')
    .replace(/(?:帮我|麻烦|请问|请|看看|看一下|顺便|然后|同时|并且|一下)/g, ' ')
    .replace(/(^|[\s?？!！。.,，;；:：])(?:你们|你)?(?:能不能|可不可以|可以|能否|能|会不会|会)(?=\s|帮我|请|搜|查|搜索|查询|$)/g, '$1')
    .replace(/(?:吗|呢|么|不|呀|啊|吧)(?=[\s?？!！。.,，;；:：]|$)/g, ' ')
    .replace(/[“”"'`()[\]{}<>，,。；;：:！!？?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INTENT_SEARCH_QUERY_CHARS)
    .trim();
}

function hasMeaningfulSearchSubject(query: string): boolean {
  return query.replace(/\s+/g, '').length >= 2;
}

export function classifyWebSearchIntent(text: string): WebSearchIntent {
  const userText = normalizeIntentText(text);
  if (!userText) return { action: 'decide' };

  const query = cleanSearchQuery(userText);
  const hasSubject = hasMeaningfulSearchSubject(query);
  if (
    hasWebSearchCapabilityQuestion(userText) &&
    (!hasSubject || isGenericCapabilityQuery(query) || MULTILINGUAL_GENERIC_CAPABILITY_RE.test(userText))
  ) {
    return { action: 'answer-capability' };
  }

  if (hasFreshInfoNeed(userText) && hasSubject) {
    return { action: 'prefetch', query, reason: 'fresh-info' };
  }

  if (EXPLICIT_SEARCH_RE.test(userText) && hasSubject) {
    return { action: 'prefetch', query, reason: 'explicit-search' };
  }

  return { action: 'decide' };
}

export function buildWebSearchCapabilityAnswer(text: string): string {
  const normalized = normalizeIntentText(text).toLowerCase();
  if (/[\u3040-\u30ff]/.test(normalized)) return 'はい、このチャットではWeb検索が有効です。';
  if (/[\uac00-\ud7af]/.test(normalized)) return '네, 현재 채팅에서 웹 검색이 켜져 있습니다.';
  if (/[\u0600-\u06ff]/.test(normalized)) return 'نعم، البحث على الويب مفعّل في هذه المحادثة.';
  if (/[а-яё]/i.test(normalized)) return 'Да, веб-поиск включен в этом чате.';
  if (/[¿¡]|\b(?:puedes|puede|buscar|búsqueda)\b/i.test(normalized)) return 'Sí, la búsqueda web está activada en este chat.';
  if (/\b(?:pouvez|peux|recherche)\b/i.test(normalized)) return 'Oui, la recherche web est activée dans ce chat.';
  if (/\b(?:kannst du|können sie|websuche|suche)\b/i.test(normalized)) return 'Ja, die Websuche ist in diesem Chat aktiviert.';
  if (/\b(?:puoi|cercare)\b/i.test(normalized)) return 'Sì, la ricerca web è attiva in questa chat.';
  if (/\b(?:pode|pesquisar)\b/i.test(normalized)) return 'Sim, a pesquisa na web está ativada neste chat.';
  return /[\u3400-\u9fff]/.test(normalized)
    ? '可以，当前聊天已开启联网搜索。'
    : 'Yes, web search is enabled for this chat.';
}
