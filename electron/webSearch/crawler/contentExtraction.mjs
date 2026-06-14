const TAG_BLOCK_BREAK = /<\/(p|div|section|article|header|footer|li|h[1-6]|br|tr)>/gi;
const SCRIPT_STYLE_BLOCKS = /<(script|style|noscript|svg|canvas|iframe)\b[\s\S]*?<\/\1>/gi;
const NOISE_BLOCKS = /<(nav|aside|form|footer|header)\b[\s\S]*?<\/\1>/gi;
const AD_NOISE_BLOCKS =
  /<([a-z][a-z0-9-]*)\b[^>]*(?:id|class|aria-label)=["'][^"']*(?:\bad\b|ads|advert|sponsor|promo|popup|modal|cookie|newsletter|subscribe|recommend|related)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG = /<[^>]+>/g;
const WHITESPACE_LINES = /\n{3,}/g;
const MAX_EXTRACTED_HTML_CHARS = 1_000_000;
const ENTITY_MAP = new Map([
  ['copy', '(c)'],
  ['ensp', ' '],
  ['equiv', '='],
  ['mdash', '-'],
  ['ndash', '-'],
  ['raquo', '>>'],
  ['rarr', '->'],
  ['reg', '(R)'],
  ['trade', '(TM)'],
]);

function decodeCodePoint(rawCodePoint, radix) {
  const codePoint = Number.parseInt(rawCodePoint, radix);
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : null;
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (match, code) => decodeCodePoint(code, 10) ?? match)
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => decodeCodePoint(code, 16) ?? match)
    .replace(/&([a-z]+);/gi, (match, name) => ENTITY_MAP.get(name.toLowerCase()) ?? match);
}

function extractTagContent(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? cleanText(match[1]).slice(0, 500) : '';
}

export function cleanText(value) {
  const text = typeof value === 'string' ? value : '';
  return decodeEntities(text.replace(HTML_TAG, ' '))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

export function extractReadableContent(html, finalUrl) {
  const input = typeof html === 'string' ? html.slice(0, MAX_EXTRACTED_HTML_CHARS) : '';
  const withoutNoise = input
    .replace(SCRIPT_STYLE_BLOCKS, '')
    .replace(NOISE_BLOCKS, '')
    .replace(AD_NOISE_BLOCKS, '');
  const title = extractTagContent(input, 'title') || finalUrl;
  const descriptionMatch = input.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const summary = descriptionMatch ? cleanText(descriptionMatch[1]) : '';
  const contentMatch =
    withoutNoise.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    withoutNoise.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ??
    withoutNoise.match(/<[^>]+\brole=["']main["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  const preferredBody = contentMatch?.[1] ?? withoutNoise;
  const preferredText = cleanText(preferredBody.replace(TAG_BLOCK_BREAK, '\n'));
  const fallbackText = contentMatch
    ? cleanText(withoutNoise.replace(TAG_BLOCK_BREAK, '\n'))
    : preferredText;
  const text = preferredText.length >= 160 || fallbackText.length <= preferredText.length
    ? preferredText
    : fallbackText;

  return {
    title,
    summary,
    content: text.replace(WHITESPACE_LINES, '\n\n'),
  };
}

export function extractJsonContent(payload, finalUrl) {
  const text = JSON.stringify(payload, null, 2);
  return {
    title: finalUrl,
    summary: '',
    content: text,
  };
}
