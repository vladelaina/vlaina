import { sanitizeWebSearchSourceUrl } from './statusMarkup';
import { WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';
import type { OpenAIToolCall, OpenAIWireMessage } from './openAIToolTypes';
import {
  MAX_LOOP_READ_CACHE_CONTENT_CHARS,
  MAX_LOOP_READ_CACHE_URLS,
  MAX_LOOP_TOOL_NAME_CHARS,
  MAX_WEB_SEARCH_BATCH_URLS,
  MAX_WEB_SEARCH_OPTION_ARG_CHARS,
  MAX_WEB_SEARCH_QUERY_ARG_CHARS,
  MAX_WEB_SEARCH_URL_ARG_CHARS,
} from './openAIToolLoopTypes';
import { canParseOpenAIToolArguments } from './openAIToolParsing';

export function normalizeToolNameForLoop(name: string): string {
  return name.slice(0, MAX_LOOP_TOOL_NAME_CHARS).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function boundedToolNameForLog(name: string): string {
  return normalizeToolNameForLoop(name) || name.slice(0, MAX_LOOP_TOOL_NAME_CHARS);
}

export function isSearchToolName(name: string): boolean {
  const normalized = normalizeToolNameForLoop(name);
  return normalized === WEB_SEARCH_TOOL_NAMES.search
    || normalized === 'search'
    || normalized === 'search_web'
    || normalized === 'searchweb'
    || normalized === 'web_search_tool'
    || normalized === 'websearch';
}

export function isReadToolName(name: string): boolean {
  const normalized = normalizeToolNameForLoop(name);
  return normalized === WEB_SEARCH_TOOL_NAMES.read
    || normalized === 'read'
    || normalized === 'read_page'
    || normalized === 'read_webpage'
    || normalized === 'read_url'
    || normalized === 'readurl'
    || normalized === 'fetch_web_page'
    || normalized === 'fetchwebpage'
    || normalized === 'fetch_url'
    || normalized === 'fetchurl';
}

export function isBatchReadToolName(name: string): boolean {
  const normalized = normalizeToolNameForLoop(name);
  return normalized === WEB_SEARCH_TOOL_NAMES.readBatch
    || normalized === 'read_pages'
    || normalized === 'read_batch'
    || normalized === 'read_webpages'
    || normalized === 'read_urls'
    || normalized === 'readurls'
    || normalized === 'fetch_web_pages'
    || normalized === 'fetchwebpages'
    || normalized === 'fetch_urls'
    || normalized === 'fetchurls';
}

export function parseToolArguments(rawArguments: string): Record<string, unknown> {
  const trimmed = rawArguments.trim();
  if (!trimmed || !canParseOpenAIToolArguments(trimmed)) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function stringToolArg(args: Record<string, unknown>, key: string, maxChars: number): string {
  const value = args[key];
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length <= maxChars ? trimmed : '';
}

export function stringArrayToolArg(
  args: Record<string, unknown>,
  key: string,
  maxChars: number,
  maxItems: number,
): string[] {
  const value = args[key];
  if (!Array.isArray(value)) return [];
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

export function contentLimitToolArg(args: Record<string, unknown>): number {
  const limit = args.contentLimit;
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return 3000;
  return Math.min(3000, Math.max(500, Math.round(limit)));
}

export function stringifyToolArgumentKey(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyToolArgumentKey(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stringifyToolArgumentKey(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function buildToolCallDedupeKey(toolCall: OpenAIToolCall): string {
  const args = parseToolArguments(toolCall.function.arguments);
  if (isSearchToolName(toolCall.function.name)) {
    return stringifyToolArgumentKey({
      name: WEB_SEARCH_TOOL_NAMES.search,
      arguments: {
        query: stringToolArg(args, 'query', MAX_WEB_SEARCH_QUERY_ARG_CHARS),
        category: stringToolArg(args, 'category', MAX_WEB_SEARCH_OPTION_ARG_CHARS),
        timeRange: stringToolArg(args, 'timeRange', MAX_WEB_SEARCH_OPTION_ARG_CHARS),
      },
    });
  }

  if (isReadToolName(toolCall.function.name)) {
    return stringifyToolArgumentKey({
      name: WEB_SEARCH_TOOL_NAMES.read,
      arguments: {
        url: stringToolArg(args, 'url', MAX_WEB_SEARCH_URL_ARG_CHARS),
        contentLimit: contentLimitToolArg(args),
      },
    });
  }

  if (isBatchReadToolName(toolCall.function.name)) {
    return stringifyToolArgumentKey({
      name: WEB_SEARCH_TOOL_NAMES.readBatch,
      arguments: {
        urls: stringArrayToolArg(args, 'urls', MAX_WEB_SEARCH_URL_ARG_CHARS, MAX_WEB_SEARCH_BATCH_URLS),
        contentLimit: contentLimitToolArg(args),
      },
    });
  }

  return stringifyToolArgumentKey({
    name: normalizeToolNameForLoop(toolCall.function.name),
    arguments: args,
  });
}

export function normalizeReadCacheUrl(url: string): string {
  const safeUrl = sanitizeWebSearchSourceUrl(url);
  if (!safeUrl) return '';

  try {
    const parsed = new URL(safeUrl);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function getReadToolUrls(toolCall: OpenAIToolCall): string[] {
  const name = toolCall.function.name;
  const args = parseToolArguments(toolCall.function.arguments);
  if (isReadToolName(name)) {
    const url = typeof args.url === 'string' ? args.url.trim() : '';
    return url ? [url] : [];
  }
  if (isBatchReadToolName(name)) {
    return Array.isArray(args.urls)
      ? args.urls
          .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
          .slice(0, MAX_LOOP_READ_CACHE_URLS)
      : [];
  }
  return [];
}

export function hasOnlySearchToolCalls(toolCalls: OpenAIToolCall[]): boolean {
  return toolCalls.length > 0 && toolCalls.every((call) => isSearchToolName(call.function.name));
}

export function hasOnlyAlreadyReadToolCalls(
  toolCalls: OpenAIToolCall[],
  readContentByUrl: Map<string, string>,
): boolean {
  return toolCalls.length > 0 && toolCalls.every((call) => {
    if (!isReadToolName(call.function.name) && !isBatchReadToolName(call.function.name)) return false;
    const urls = getReadToolUrls(call);
    return urls.length > 0 && urls.every((url) => readContentByUrl.has(normalizeReadCacheUrl(url)));
  });
}

export function buildCachedReadToolMessages(
  toolCalls: OpenAIToolCall[],
  readContentByUrl: Map<string, string>,
): OpenAIWireMessage[] {
  return toolCalls.map((toolCall) => {
    const urls = getReadToolUrls(toolCall);
    const cachedContent = urls
      .map((url) => readContentByUrl.get(normalizeReadCacheUrl(url)))
      .filter((content): content is string => typeof content === 'string' && content.trim().length > 0)
      .join('\n\n');
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: [
        'Cached page read. Use it; do not reread.',
        '',
        cachedContent,
      ].join('\n'),
    };
  });
}

export function cacheReadContentForToolMessages(
  readContentByUrl: Map<string, string>,
  toolCalls: OpenAIToolCall[],
  toolMessages: OpenAIWireMessage[],
): void {
  toolCalls.forEach((toolCall, index) => {
    const toolMessage = toolMessages[index];
    const content = typeof toolMessage?.content === 'string' ? toolMessage.content : '';
    if (!content.trim()) return;
    const urls = getReadToolUrls(toolCall);
    if (urls.length !== 1) return;
    const safeUrl = sanitizeWebSearchSourceUrl(urls[0]);
    if (!safeUrl) return;
    const normalized = normalizeReadCacheUrl(safeUrl);
    if (normalized && !readContentByUrl.has(normalized)) {
      readContentByUrl.set(normalized, content.slice(0, MAX_LOOP_READ_CACHE_CONTENT_CHARS));
    }
  });
}
