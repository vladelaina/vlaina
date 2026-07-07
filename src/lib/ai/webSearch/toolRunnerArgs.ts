import { canParseOpenAIToolArguments } from './openAIToolParsing';
import { WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';

const MAX_WEB_SEARCH_QUERY_ARG_CHARS = 1000;
const MAX_WEB_SEARCH_URL_ARG_CHARS = 16 * 1024;
const MAX_WEB_SEARCH_OPTION_ARG_CHARS = 64;
const MAX_WEB_SEARCH_BATCH_URLS = 8;
const MAX_WEB_SEARCH_TOOL_NAME_CHARS = 128;

export function parseArguments(rawArguments: string): Record<string, unknown> {
  const trimmed = rawArguments.trim();
  if (!trimmed || !canParseOpenAIToolArguments(trimmed)) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stringArg(args: Record<string, unknown>, key: string, maxChars: number): string {
  const value = args[key];
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length <= maxChars ? trimmed : '';
}

function stringArrayArg(args: Record<string, unknown>, key: string, maxChars: number, maxItems: number): string[] {
  const value = args[key];
  if (!Array.isArray(value)) {
    return [];
  }
  const result: string[] = [];
  for (const item of value) {
    if (result.length >= maxItems) break;
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length > 0 && trimmed.length <= maxChars) {
      result.push(trimmed);
    }
  }
  return result;
}

function numberArg(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function searchQueryArg(args: Record<string, unknown>): string {
  return stringArg(args, 'query', MAX_WEB_SEARCH_QUERY_ARG_CHARS);
}

export function searchCategoryArg(args: Record<string, unknown>): string | undefined {
  return stringArg(args, 'category', MAX_WEB_SEARCH_OPTION_ARG_CHARS) || undefined;
}

export function searchTimeRangeArg(args: Record<string, unknown>): string | undefined {
  return stringArg(args, 'timeRange', MAX_WEB_SEARCH_OPTION_ARG_CHARS) || undefined;
}

export function readUrlArg(args: Record<string, unknown>): string {
  return stringArg(args, 'url', MAX_WEB_SEARCH_URL_ARG_CHARS);
}

export function readBatchUrlsArg(args: Record<string, unknown>): string[] {
  return stringArrayArg(args, 'urls', MAX_WEB_SEARCH_URL_ARG_CHARS, MAX_WEB_SEARCH_BATCH_URLS);
}

export function contentLimitArg(args: Record<string, unknown>): number {
  const limit = numberArg(args, 'contentLimit');
  if (!limit) return 3000;
  return Math.min(3000, Math.max(500, Math.round(limit)));
}

export function normalizeToolName(name: string): string {
  const boundedName = name.slice(0, MAX_WEB_SEARCH_TOOL_NAME_CHARS);
  const normalized = boundedName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (
    normalized === WEB_SEARCH_TOOL_NAMES.search ||
    normalized === 'search' ||
    normalized === 'search_web' ||
    normalized === 'searchweb' ||
    normalized === 'web_search_tool' ||
    normalized === 'websearch'
  ) {
    return WEB_SEARCH_TOOL_NAMES.search;
  }
  if (
    normalized === WEB_SEARCH_TOOL_NAMES.read ||
    normalized === 'read' ||
    normalized === 'read_page' ||
    normalized === 'read_webpage' ||
    normalized === 'read_url' ||
    normalized === 'readurl' ||
    normalized === 'fetch_web_page' ||
    normalized === 'fetchwebpage' ||
    normalized === 'fetch_url' ||
    normalized === 'fetchurl'
  ) {
    return WEB_SEARCH_TOOL_NAMES.read;
  }
  if (
    normalized === WEB_SEARCH_TOOL_NAMES.readBatch ||
    normalized === 'read_pages' ||
    normalized === 'read_batch' ||
    normalized === 'read_webpages' ||
    normalized === 'read_urls' ||
    normalized === 'readurls' ||
    normalized === 'fetch_web_pages' ||
    normalized === 'fetchwebpages' ||
    normalized === 'fetch_urls' ||
    normalized === 'fetchurls'
  ) {
    return WEB_SEARCH_TOOL_NAMES.readBatch;
  }
  return normalized || boundedName;
}
