import { getTextContent } from './runs';

const VLOOK_ACCENT_TOKENS = [
  'wn',
  'rd',
  'og',
  'tu',
  'ye',
  'lm',
  'gn',
  'mn',
  'ol',
  'aq',
  'sk',
  'cy',
  'bu',
  'se',
  'la',
  'vn',
  'cf',
  'au',
  'pu',
  'ro',
  'pl',
  'pk',
  'gd',
  'bn',
  'gy',
  'wt',
  'bk',
  't1',
  't2',
] as const;

const VLOOK_ACCENT_TOKEN_SET = new Set<string>(VLOOK_ACCENT_TOKENS);

export function getVlookAccentToken(text: string): string | null {
  const normalized = text
    .trim()
    .toLowerCase()
    .match(/^(?:[#.[(]\s*)?([a-z][a-z0-9]?)(?=$|[\s:：|/)\]._-])/)?.[1];
  return normalized && VLOOK_ACCENT_TOKEN_SET.has(normalized) ? normalized : null;
}

export function getVlookAccentTokenFromNode(node: any): string | null {
  return getVlookAccentToken(getTextContent(node));
}

export function getCombinedClass(...classNames: Array<string | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}
