import type { ChatCompletionRequest } from '@/lib/ai/types';
import { buildWebSearchStatusMarkup, sanitizeWebSearchSourceUrl, sanitizeWebSearchStatus } from './statusMarkup';
import { buildWebSearchTools, WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';
import { runWebSearchToolCall, type WebSearchToolRunnerOptions } from './toolRunner';
import type { WebSearchStatus } from './types';
import { createWebSearchClient } from './client';
import { formatBatchPagesForModel, formatSearchResultsForModel } from './format';
import { consumeOpenAIStreamWithTools } from './openAIStreamWithTools';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { addChatDebugLog } from '@/lib/debug/chatDebugLog';
import {
  appendWebSearchSystemInstruction,
  canParseOpenAIToolArguments,
  extractOpenAIMessageFromJson,
} from './openAIToolParsing';
import type { OpenAIToolCall, OpenAIWireMessage } from './openAIToolTypes';

const MAX_WEB_SEARCH_TOOL_LOOPS = 6;
const MAX_NO_RESULT_SEARCH_ATTEMPTS = 3;

interface ToolLoopOptions extends WebSearchToolRunnerOptions {
  body: ChatCompletionRequest;
  onChunk: (chunk: string) => void;
  onApiTranscript?: (messages: OpenAIWireMessage[]) => void;
  request: (body: ChatCompletionRequest) => Promise<Response>;
}

interface JsonToolLoopOptions extends WebSearchToolRunnerOptions {
  body: ChatCompletionRequest;
  onChunk: (chunk: string) => void;
  onApiTranscript?: (messages: OpenAIWireMessage[]) => void;
  requestJson: (body: ChatCompletionRequest) => Promise<Record<string, unknown>>;
}

interface PrefetchOptions extends WebSearchToolRunnerOptions {
  body: ChatCompletionRequest;
  onChunk: (chunk: string) => void;
  onApiTranscript?: (messages: OpenAIWireMessage[]) => void;
}

interface StreamingTextProtocolOptions extends PrefetchOptions {
  request: (body: ChatCompletionRequest) => Promise<Response>;
}

interface JsonTextProtocolOptions extends PrefetchOptions {
  requestJson: (body: ChatCompletionRequest) => Promise<Record<string, unknown>>;
}

interface TextRequestProtocolOptions extends PrefetchOptions {
  requestText: (body: ChatCompletionRequest, onChunk: (content: string) => void) => Promise<string>;
}

function withStatusPrefix(statuses: WebSearchStatus[], content: string): string {
  if (statuses.length === 0) return content;
  const separator = content.trim().length > 0 ? '\n\n' : '';
  return `${statuses.map(buildWebSearchStatusMarkup).join('')}${separator}${content}`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('The web search request was cancelled.', 'AbortError');
}

function emitChunk(onChunk: (chunk: string) => void, signal: AbortSignal | undefined, chunk: string): void {
  throwIfAborted(signal);
  onChunk(chunk);
  throwIfAborted(signal);
}

function emitApiTranscript(
  onApiTranscript: ((messages: OpenAIWireMessage[]) => void) | undefined,
  signal: AbortSignal | undefined,
  messages: OpenAIWireMessage[],
): void {
  throwIfAborted(signal);
  onApiTranscript?.(messages);
  throwIfAborted(signal);
}

function emitWebSearchStatus(
  onStatus: ((status: WebSearchStatus) => void) | undefined,
  signal: AbortSignal | undefined,
  status: WebSearchStatus,
): void {
  throwIfAborted(signal);
  const safeStatus = sanitizeWebSearchStatus(status);
  if (safeStatus) {
    onStatus?.(safeStatus);
  }
  throwIfAborted(signal);
}

function appendSuccessfulReadSources(target: string[], status: WebSearchStatus): void {
  if (!hasSuccessfulRead(status)) return;
  for (const url of status.urls ?? []) {
    const safeUrl = sanitizeWebSearchSourceUrl(url);
    if (!safeUrl) continue;
    if (!target.includes(safeUrl)) target.push(safeUrl);
  }
}

function withSourceLinks(content: string, sourceUrls: string[]): string {
  const urls = sourceUrls.slice(0, 5);
  const missingUrls = urls.filter((url) => !content.includes(url));
  if (missingUrls.length === 0) return content;
  return `${content.trimEnd()}\n\nSources:\n${missingUrls.map((url) => `- ${url}`).join('\n')}`;
}

function buildFinalAssistantTranscriptMessage(content: string, reasoningContent?: string): OpenAIWireMessage {
  const message: OpenAIWireMessage = {
    role: 'assistant',
    content,
  };
  if (reasoningContent) {
    message.reasoning_content = reasoningContent;
  }
  return message;
}

function resolveFinalAssistantApiContent(result: {
  content: string;
  assistantContent?: string;
}, sourceUrls: string[]): string {
  return withSourceLinks(result.assistantContent ?? result.content, sourceUrls);
}

function hasSuccessfulRead(status: WebSearchStatus): boolean {
  if (status.phase !== 'complete') return false;
  if (typeof status.metrics?.successCount === 'number') {
    return status.metrics.successCount > 0;
  }
  return (status.urls?.length ?? 0) > 0;
}

function shouldRequirePageRead(
  status: WebSearchStatus | null,
  latestResultsHaveSuccessfulRead: boolean,
  forcedReadExhausted: boolean,
): boolean {
  return status?.phase === 'results'
    && !latestResultsHaveSuccessfulRead
    && !forcedReadExhausted
    && (status.results?.length ?? 0) > 0;
}

function buildReadReminderMessage(): OpenAIWireMessage {
  return {
    role: 'system',
    content: 'Read one result page before answering.',
  };
}

function buildVisibleAnswerReminderMessage(): OpenAIWireMessage {
  return {
    role: 'system',
    content: 'Answer now. No tools. Cite URLs.',
  };
}

function hasVisibleAnswerContent(content: string): boolean {
  return stripThinkingContent(content).trim().length > 0;
}

function throwIfMissingVisibleAnswer(content: string): void {
  if (hasVisibleAnswerContent(content)) return;
  throw new Error('The model completed web search but returned no visible answer.');
}

function hasAnySearchResults(statusHistory: WebSearchStatus[]): boolean {
  return statusHistory.some((status) => status.phase === 'results' && (status.results?.length ?? 0) > 0);
}

function countNoResultSearchAttempts(statusHistory: WebSearchStatus[]): number {
  return statusHistory.filter((status) =>
    status.phase === 'error' &&
    typeof status.metrics?.resultCount === 'number' &&
    status.metrics.resultCount === 0
  ).length;
}

function shouldStopNoResultSearchLoop(statusHistory: WebSearchStatus[]): boolean {
  return !hasAnySearchResults(statusHistory) && countNoResultSearchAttempts(statusHistory) >= MAX_NO_RESULT_SEARCH_ATTEMPTS;
}

function buildNoSearchResultsAnswer(body: ChatCompletionRequest): string {
  const userText = getLatestUserText(body);
  const isChinese = /[\u3400-\u9fff]/.test(userText);
  return isChinese
    ? '我这边连续尝试了几个搜索词，但都没有找到可用的联网搜索结果，所以不能可靠确认这个问题的最新信息。你可以换一个更具体的名称、官网名或英文关键词再试。'
    : 'I tried several search queries but could not find usable web results, so I cannot reliably verify the latest information for this request. Try a more specific name, official site, or English keyword.';
}

function finishNoResultSearchLocally({
  body,
  statusHistory,
  onChunk,
  onApiTranscript,
  signal,
}: {
  body: ChatCompletionRequest;
  statusHistory: WebSearchStatus[];
  onChunk: (chunk: string) => void;
  onApiTranscript?: (messages: OpenAIWireMessage[]) => void;
  signal?: AbortSignal;
}): string {
  const content = buildNoSearchResultsAnswer(body);
  const finalContent = withStatusPrefix(statusHistory, content);
  emitApiTranscript(onApiTranscript, signal, [buildFinalAssistantTranscriptMessage(content)]);
  emitChunk(onChunk, signal, finalContent);
  return finalContent;
}

function normalizeToolNameForLoop(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function isSearchToolName(name: string): boolean {
  const normalized = normalizeToolNameForLoop(name);
  return normalized === WEB_SEARCH_TOOL_NAMES.search
    || normalized === 'search'
    || normalized === 'search_web'
    || normalized === 'searchweb'
    || normalized === 'web_search_tool'
    || normalized === 'websearch';
}

function isReadToolName(name: string): boolean {
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

function isBatchReadToolName(name: string): boolean {
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

function parseToolArguments(rawArguments: string): Record<string, unknown> {
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

function normalizeReadCacheUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return trimmed.replace(/\/$/, '');
  }
}

function getReadToolUrls(toolCall: OpenAIToolCall): string[] {
  const name = toolCall.function.name;
  const args = parseToolArguments(toolCall.function.arguments);
  if (isReadToolName(name)) {
    const url = typeof args.url === 'string' ? args.url.trim() : '';
    return url ? [url] : [];
  }
  if (isBatchReadToolName(name)) {
    return Array.isArray(args.urls)
      ? args.urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      : [];
  }
  return [];
}

function hasOnlySearchToolCalls(toolCalls: OpenAIToolCall[]): boolean {
  return toolCalls.length > 0 && toolCalls.every((call) => isSearchToolName(call.function.name));
}

function hasOnlyAlreadyReadToolCalls(
  toolCalls: OpenAIToolCall[],
  readContentByUrl: Map<string, string>,
): boolean {
  return toolCalls.length > 0 && toolCalls.every((call) => {
    if (!isReadToolName(call.function.name) && !isBatchReadToolName(call.function.name)) return false;
    const urls = getReadToolUrls(call);
    return urls.length > 0 && urls.every((url) => readContentByUrl.has(normalizeReadCacheUrl(url)));
  });
}

function buildCachedReadToolMessages(
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

function cacheReadContentForToolMessages(
  readContentByUrl: Map<string, string>,
  toolCalls: OpenAIToolCall[],
  toolMessages: OpenAIWireMessage[],
): void {
  toolCalls.forEach((toolCall, index) => {
    const toolMessage = toolMessages[index];
    const content = typeof toolMessage?.content === 'string' ? toolMessage.content : '';
    if (!content.trim()) return;
    for (const url of getReadToolUrls(toolCall)) {
      const safeUrl = sanitizeWebSearchSourceUrl(url);
      if (!safeUrl) continue;
      const normalized = normalizeReadCacheUrl(safeUrl);
      if (normalized && !readContentByUrl.has(normalized)) {
        readContentByUrl.set(normalized, content);
      }
    }
  });
}

function buildNoToolRecoveryMessages(
  body: ChatCompletionRequest,
  messages: OpenAIWireMessage[],
  sourceUrls: string[],
  reminderMessage: OpenAIWireMessage,
): OpenAIWireMessage[] {
  const toolContext = messages
    .filter((message) => message.role === 'tool' && typeof message.content === 'string' && message.content.trim().length > 0)
    .map((message) => message.content as string)
    .join('\n\n')
    .slice(0, 12000);
  const baseMessages = (body.messages as OpenAIWireMessage[]).filter((message) => message.role !== 'tool');
  const contextMessage: OpenAIWireMessage | null = toolContext.trim().length > 0 || sourceUrls.length > 0
    ? {
      role: 'system',
      content: [
        'Web context:',
        toolContext || '(No readable web context.)',
        sourceUrls.length > 0 ? `Sources: ${sourceUrls.join(', ')}` : '',
      ].filter(Boolean).join('\n'),
    }
    : null;
  return [
    ...baseMessages,
    ...(contextMessage ? [contextMessage] : []),
    reminderMessage,
  ];
}

function withoutTools(body: ChatCompletionRequest): ChatCompletionRequest {
  const { tools: _tools, tool_choice: _toolChoice, ...rest } = body;
  return rest;
}

function extractWireMessageText(content: OpenAIWireMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part): part is Extract<NonNullable<OpenAIWireMessage['content']>[number], { type: 'text' }> =>
      typeof part === 'object' && part !== null && part.type === 'text')
    .map((part) => part.text)
    .join('\n\n');
}

function getLatestUserText(body: ChatCompletionRequest): string {
  for (let index = body.messages.length - 1; index >= 0; index -= 1) {
    const message = body.messages[index] as OpenAIWireMessage;
    if (message.role !== 'user') continue;
    const text = extractWireMessageText(message.content).trim();
    if (text) return text;
  }
  return '';
}

function buildTextProtocolDecisionMessage(): OpenAIWireMessage {
  return {
    role: 'system',
    content: [
      'Web search is optional.',
      'Answer directly unless fresh/verifiable info is needed.',
      'If search is needed, output only:',
      '<web_search_request>{"query":"short search query","reason":"why search is needed"}</web_search_request>',
    ].join('\n'),
  };
}

function buildTextProtocolAnswerPrompt({
  userText,
  searchContent,
  pageContent,
}: {
  userText: string;
  searchContent: string;
  pageContent: string;
}): OpenAIWireMessage {
  return {
    role: 'system',
    content: [
      'Answer from web context. No more search. Cite URLs.',
      '',
      `User: ${userText}`,
      '',
      'Results:',
      searchContent,
      '',
      'Pages:',
      pageContent || '(No readable pages.)',
    ].join('\n'),
  };
}

function parseTextProtocolSearchRequest(content: string): { query: string; reason?: string } | null {
  const visible = stripThinkingContent(content).trim();
  const match =
    /<web_search_request>\s*([\s\S]*?)\s*<\/web_search_request>/i.exec(visible) ||
    /^<web_search_request>\s*([\s\S]*)$/i.exec(visible);
  if (!match) return null;

  try {
    const jsonText = match[1].trim().replace(/\s*<\/web_search_request>\s*$/i, '');
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const query = typeof parsed.query === 'string' ? parsed.query.trim() : '';
    if (!query) return null;
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';
    return { query, ...(reason ? { reason } : {}) };
  } catch {
    return null;
  }
}

function normalizeFallbackSearchQuery(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b(search|web search|look up|lookup|google|browse)\b/gi, ' ')
    .replace(/(搜索一下|搜一下|查一下|搜搜|搜索|联网|上网|查找|查询|搜)/g, ' ')
    .replace(/(帮我|麻烦|请问|看看|看一下|就是|一下|吗|呢)/g, ' ')
    .replace(/不[？?]?$/g, ' ')
    .replace(/最后一级/g, '最后一集')
    .replace(/\s+/g, ' ')
    .replace(/\s+([？?，,。])/g, '$1')
    .trim();
}

function simplifySearchQuery(value: string): string {
  const normalized = normalizeFallbackSearchQuery(value)
    .replace(/\b(release date|published date|latest|update|follow up|sequel)\b/gi, ' ')
    .replace(/(发布时间|发布日期|最新消息|最新|后续计划|后续|还会发布|什么时候发布|是什么时候发布的)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length > 4) {
    return parts.slice(0, 4).join(' ');
  }
  return normalized;
}

function buildTextProtocolSearchQueries(modelQuery: string, userText: string): string[] {
  const queries: string[] = [];
  const add = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    if (queries.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) return;
    queries.push(normalized);
  };

  add(modelQuery);
  add(simplifySearchQuery(modelQuery));
  add(normalizeFallbackSearchQuery(userText));
  add(simplifySearchQuery(userText));
  return queries.slice(0, 3);
}

function sanitizeSearchResults<T extends { url?: unknown }>(results: readonly T[], limit: number): Array<T & { url: string }> {
  return results.slice(0, limit).flatMap((result) => {
    const url = sanitizeWebSearchSourceUrl(result.url);
    return url ? [{ ...result, url }] : [];
  });
}

async function buildTextProtocolSearchMessages({
  body,
  query,
  client: providedClient,
  onStatus,
  signal,
}: Pick<PrefetchOptions, 'body' | 'client' | 'onStatus' | 'signal'> & { query: string }): Promise<{
  messages: OpenAIWireMessage[];
  statusHistory: WebSearchStatus[];
  sourceUrls: string[];
}> {
  const client = providedClient ?? createWebSearchClient();
  const userText = getLatestUserText(body);
  const statusHistory: WebSearchStatus[] = [];
  const sourceUrls: string[] = [];
  const emitStatus = (status: WebSearchStatus) => {
    const safeStatus = sanitizeWebSearchStatus(status);
    if (!safeStatus) return;
    statusHistory.push(safeStatus);
    appendSuccessfulReadSources(sourceUrls, safeStatus);
    emitWebSearchStatus(onStatus, signal, safeStatus);
  };

  throwIfAborted(signal);
  const searchQueries = buildTextProtocolSearchQueries(query, userText);
  let searchResponse = null as Awaited<ReturnType<typeof client.webSearch>> | null;
  let resultsStatus: WebSearchStatus | null = null;
  let pageContent = '';
  for (const searchQuery of searchQueries) {
    const searchStartedAt = performance.now();
    addChatDebugLog('web-search-text-protocol', 'search attempt started', {
      query: searchQuery,
      isFallback: searchQuery !== query,
    });
    emitStatus({ phase: 'searching', query: searchQuery });
    const attemptResponse = signal
      ? await client.webSearch(searchQuery, { limit: 5 }, signal)
      : await client.webSearch(searchQuery, { limit: 5 });
    throwIfAborted(signal);
    const safeResults = sanitizeSearchResults(attemptResponse.results, 5);
    const safeSearchResponse = { ...attemptResponse, results: safeResults };
    const attemptStatus: WebSearchStatus = {
      phase: safeResults.length > 0 ? 'results' : 'error',
      query: attemptResponse.query,
      results: safeResults.slice(0, 5),
      metrics: {
        durationMs: elapsedSince(searchStartedAt),
        resultCount: safeResults.length,
      },
      message: safeResults.length > 0 ? undefined : 'No relevant results were found.',
    };
    addChatDebugLog('web-search-text-protocol', 'search attempt completed', {
      query: attemptResponse.query,
      resultCount: safeResults.length,
      durationMs: attemptStatus.metrics?.durationMs,
    }, safeResults.length > 0 ? 'info' : 'warn');
    emitStatus(attemptStatus);
    searchResponse = safeSearchResponse;
    resultsStatus = attemptStatus;
    if (safeResults.length === 0) {
      continue;
    }

    const urls = getPrefetchReadUrls(attemptStatus);
    if (urls.length === 0) {
      break;
    }

    const readStartedAt = performance.now();
    emitStatus({ phase: 'reading', urls });
    const pages = signal
      ? await client.readWebPages(urls, { contentLimit: 3000, retries: 0 }, signal)
      : await client.readWebPages(urls, { contentLimit: 3000, retries: 0 });
    throwIfAborted(signal);
    const successfulPages = pages.filter((page) => page.ok);
    const failedPages = pages.filter((page) => !page.ok);
    emitStatus({
      phase: 'complete',
      urls: successfulPages.map((page) => page.page?.finalUrl || page.url),
      failedSources: failedPages.map((page) => ({
        url: page.url,
        message: page.error || 'Unable to read this page.',
      })),
      metrics: {
        durationMs: elapsedSince(readStartedAt),
        failureCount: failedPages.length,
        successCount: successfulPages.length,
      },
    });
    pageContent = formatBatchPagesForModel(pages);
    if (successfulPages.length > 0 || searchQuery === searchQueries[searchQueries.length - 1]) {
      break;
    }
    addChatDebugLog('web-search-text-protocol', 'read attempt had no readable pages; trying fallback query', {
      query: attemptResponse.query,
      failedUrls: failedPages.map((page) => page.url),
    }, 'warn');
  }

  if (!searchResponse || !resultsStatus) {
    throw new Error('Web search did not run.');
  }

  return {
    messages: [
      ...body.messages as OpenAIWireMessage[],
      buildTextProtocolAnswerPrompt({
        userText,
        searchContent: formatSearchResultsForModel(searchResponse),
        pageContent,
      }),
    ],
    statusHistory,
    sourceUrls,
  };
}

function elapsedSince(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function collectUniqueSearchResultUrls(
  status: WebSearchStatus,
  options: {
    limit?: number;
    exclude?: Set<string>;
  } = {},
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const result of status.results ?? []) {
    if (options.limit !== undefined && urls.length >= options.limit) break;
    const url = sanitizeWebSearchSourceUrl(result.url);
    if (!url || seen.has(url) || options.exclude?.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function getPrefetchReadUrls(status: WebSearchStatus): string[] {
  return collectUniqueSearchResultUrls(status, { limit: 3 });
}

function buildForcedReadToolCall(
  status: WebSearchStatus,
  loopIndex: number,
  attemptedUrls: Set<string>,
): OpenAIToolCall | null {
  const urls = collectUniqueSearchResultUrls(status, {
    exclude: attemptedUrls,
    limit: 3,
  });

  if (urls.length === 0) {
    return null;
  }

  return {
    id: `forced_read_${loopIndex}`,
    type: 'function',
    function: {
      name: WEB_SEARCH_TOOL_NAMES.readBatch,
      arguments: JSON.stringify({ urls }),
    },
  };
}

function getReadableResultUrls(status: WebSearchStatus): string[] {
  return collectUniqueSearchResultUrls(status);
}

function buildAssistantToolMessage(result: {
  content: string;
  assistantContent?: string;
  reasoningContent?: string;
  toolCalls: OpenAIToolCall[];
}): OpenAIWireMessage {
  const message: OpenAIWireMessage = {
    role: 'assistant',
    content: (result.assistantContent ?? result.content) || '',
    tool_calls: result.toolCalls,
  };
  if (result.reasoningContent) {
    message.reasoning_content = result.reasoningContent;
  }
  return message;
}

async function runToolCallsInParallel(
  toolCalls: OpenAIToolCall[],
  options: WebSearchToolRunnerOptions,
): Promise<OpenAIWireMessage[]> {
  const toolResults = await Promise.all(
    toolCalls.map(async (toolCall) => ({
      toolCall,
      content: await runWebSearchToolCall(toolCall.function, options),
    })),
  );

  return toolResults.map(({ toolCall, content }) => ({
    role: 'tool',
    tool_call_id: toolCall.id,
    name: toolCall.function.name,
    content,
  }));
}

async function appendForcedReadMessages(
  messages: OpenAIWireMessage[],
  status: WebSearchStatus,
  loopIndex: number,
  options: WebSearchToolRunnerOptions,
  attemptedUrls: Set<string>,
): Promise<{
  messages: OpenAIWireMessage[];
  addedMessages: OpenAIWireMessage[];
  attemptedUrls: string[];
  exhausted: boolean;
}> {
  const toolCall = buildForcedReadToolCall(status, loopIndex, attemptedUrls);

  if (!toolCall) {
    const addedMessages = [buildReadReminderMessage()];
    return {
      messages: [...messages, ...addedMessages],
      addedMessages,
      attemptedUrls: [],
      exhausted: true,
    };
  }

  const args = parseToolArguments(toolCall.function.arguments);
  const urls = Array.isArray(args.urls)
    ? args.urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0).slice(0, 3)
    : [];
  for (const url of urls) attemptedUrls.add(url);
  const toolResult = await runWebSearchToolCall(toolCall.function, options);
  const allReadableUrls = getReadableResultUrls(status);
  const addedMessages: OpenAIWireMessage[] = [
    {
      role: 'assistant',
      content: '',
      tool_calls: [toolCall],
    },
    {
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: toolResult,
    },
  ];
  return {
    messages: [
      ...messages,
      ...addedMessages,
    ],
    addedMessages,
    attemptedUrls: urls,
    exhausted: allReadableUrls.every((url) => attemptedUrls.has(url)),
  };
}

async function recoverStreamingVisibleAnswer({
  body,
  messages,
  statusHistory,
  sourceUrls,
  request,
  onChunk,
  onApiTranscript,
  responseTranscript,
  signal,
}: {
  body: ChatCompletionRequest;
  messages: OpenAIWireMessage[];
  statusHistory: WebSearchStatus[];
  sourceUrls: string[];
  request: (body: ChatCompletionRequest) => Promise<Response>;
  onChunk: (chunk: string) => void;
  onApiTranscript?: (messages: OpenAIWireMessage[]) => void;
  responseTranscript: OpenAIWireMessage[];
  signal?: AbortSignal;
}): Promise<string> {
  throwIfAborted(signal);
  const reminderMessage = buildVisibleAnswerReminderMessage();
  responseTranscript.push(reminderMessage);
  const startedAt = Date.now();
  addChatDebugLog('web-search-loop', 'stream no-tools recovery request started', {
    messages: messages.length + 1,
    sourceUrls,
  }, 'warn');
  const response = await request({
    ...withoutTools(body),
    messages: buildNoToolRecoveryMessages(body, messages, sourceUrls, reminderMessage) as ChatCompletionRequest['messages'],
  });
  const result = await consumeOpenAIStreamWithTools(response, (content) => {
    emitChunk(onChunk, signal, withStatusPrefix(statusHistory, content));
  }, { signal });
  throwIfAborted(signal);
  const visibleAnswerContent = result.assistantContent || stripThinkingContent(result.content);
  throwIfMissingVisibleAnswer(visibleAnswerContent);
  const finalContent = withSourceLinks(result.content, sourceUrls);
  addChatDebugLog('web-search-loop', 'stream no-tools recovery completed', {
    durationMs: Date.now() - startedAt,
    visibleChars: visibleAnswerContent.length,
    finalChars: finalContent.length,
  });
  const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
  responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
  emitApiTranscript(onApiTranscript, signal, responseTranscript);
  return withStatusPrefix(statusHistory, finalContent);
}

async function recoverJsonVisibleAnswer({
  body,
  messages,
  statusHistory,
  sourceUrls,
  requestJson,
  onChunk,
  onApiTranscript,
  responseTranscript,
  signal,
}: {
  body: ChatCompletionRequest;
  messages: OpenAIWireMessage[];
  statusHistory: WebSearchStatus[];
  sourceUrls: string[];
  requestJson: (body: ChatCompletionRequest) => Promise<Record<string, unknown>>;
  onChunk: (chunk: string) => void;
  onApiTranscript?: (messages: OpenAIWireMessage[]) => void;
  responseTranscript: OpenAIWireMessage[];
  signal?: AbortSignal;
}): Promise<string> {
  throwIfAborted(signal);
  const reminderMessage = buildVisibleAnswerReminderMessage();
  responseTranscript.push(reminderMessage);
  const startedAt = Date.now();
  addChatDebugLog('web-search-loop', 'json no-tools recovery request started', {
    messages: messages.length + 1,
    sourceUrls,
  }, 'warn');
  const payload = await requestJson({
    ...withoutTools(body),
    stream: false,
    messages: buildNoToolRecoveryMessages(body, messages, sourceUrls, reminderMessage) as ChatCompletionRequest['messages'],
  });
  throwIfAborted(signal);
  const result = extractOpenAIMessageFromJson(payload);
  if (result.toolCalls.length > 0 && !hasVisibleAnswerContent(result.content)) {
    const fallbackAnswer = buildNoSearchResultsAnswer(body);
    const finalContent = withStatusPrefix(statusHistory, fallbackAnswer);
    addChatDebugLog('web-search-loop', 'json no-tools recovery returned tool markup; using fallback answer', {
      durationMs: Date.now() - startedAt,
      toolCalls: result.toolCalls.map((call) => call.function.name),
    }, 'warn');
    responseTranscript.push(buildFinalAssistantTranscriptMessage(fallbackAnswer, result.reasoningContent));
    emitApiTranscript(onApiTranscript, signal, responseTranscript);
    emitChunk(onChunk, signal, finalContent);
    return finalContent;
  }
  throwIfMissingVisibleAnswer(result.content);
  const finalAnswerContent = withSourceLinks(result.content, sourceUrls);
  addChatDebugLog('web-search-loop', 'json no-tools recovery completed', {
    durationMs: Date.now() - startedAt,
    visibleChars: result.content.length,
    finalChars: finalAnswerContent.length,
  });
  const finalContent = withStatusPrefix(statusHistory, finalAnswerContent);
  const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
  responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
  emitApiTranscript(onApiTranscript, signal, responseTranscript);
  emitChunk(onChunk, signal, finalContent);
  return finalContent;
}

export async function runOpenAIWebSearchTextProtocolRequest({
  body,
  onChunk,
  onStatus,
  onApiTranscript,
  request,
  client,
  signal,
}: StreamingTextProtocolOptions): Promise<string> {
  throwIfAborted(signal);
  addChatDebugLog('web-search-text-protocol', 'stream decision request started', {
    messages: body.messages.length,
    latestUserText: getLatestUserText(body).slice(0, 240),
  });
  const decisionMessages = [
    buildTextProtocolDecisionMessage(),
    ...body.messages as OpenAIWireMessage[],
  ];
  const decisionResponse = await request({
    ...withoutTools(body),
    messages: decisionMessages as ChatCompletionRequest['messages'],
  });
  const decision = await consumeOpenAIStreamWithTools(decisionResponse, () => {}, { signal });
  throwIfAborted(signal);
  const searchRequest = parseTextProtocolSearchRequest(decision.assistantContent || decision.content);

  if (!searchRequest) {
    const directContent = decision.content;
    throwIfMissingVisibleAnswer(directContent);
    addChatDebugLog('web-search-text-protocol', 'stream decision answered directly', {
      visibleChars: stripThinkingContent(directContent).length,
    });
    emitChunk(onChunk, signal, directContent);
    emitApiTranscript(onApiTranscript, signal, [
      buildFinalAssistantTranscriptMessage(decision.assistantContent || directContent, decision.reasoningContent),
    ]);
    return directContent;
  }

  addChatDebugLog('web-search-text-protocol', 'stream decision requested search', {
    query: searchRequest.query,
    reason: searchRequest.reason ?? '',
  });
  const {
    messages,
    statusHistory,
    sourceUrls,
  } = await buildTextProtocolSearchMessages({ body, query: searchRequest.query, client, onStatus, signal });

  let latestContent = '';
  const emitContent = (content: string) => {
    latestContent = content;
    emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
  };

  emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
  const answerResponse = await request({
    ...withoutTools(body),
    messages: messages as ChatCompletionRequest['messages'],
  });
  const answer = await consumeOpenAIStreamWithTools(answerResponse, emitContent, { signal });
  throwIfAborted(signal);
  const finalApiContent = withSourceLinks(answer.assistantContent || answer.content, sourceUrls);
  throwIfMissingVisibleAnswer(finalApiContent);
  const finalContent = withStatusPrefix(statusHistory, finalApiContent);
  addChatDebugLog('web-search-text-protocol', 'stream search answer completed', {
    statuses: statusHistory.map((status) => status.phase),
    sources: sourceUrls,
    finalChars: finalApiContent.length,
  });
  emitChunk(onChunk, signal, finalContent);
  emitApiTranscript(onApiTranscript, signal, [
    buildFinalAssistantTranscriptMessage(finalApiContent, answer.reasoningContent),
  ]);
  return finalContent;
}

export async function runOpenAIWebSearchJsonTextProtocolRequest({
  body,
  onChunk,
  onStatus,
  onApiTranscript,
  requestJson,
  client,
  signal,
}: JsonTextProtocolOptions): Promise<string> {
  throwIfAborted(signal);
  addChatDebugLog('web-search-text-protocol', 'json decision request started', {
    messages: body.messages.length,
    latestUserText: getLatestUserText(body).slice(0, 240),
  });
  const decisionMessages = [
    buildTextProtocolDecisionMessage(),
    ...body.messages as OpenAIWireMessage[],
  ];
  const decisionPayload = await requestJson({
    ...withoutTools(body),
    stream: false,
    messages: decisionMessages as ChatCompletionRequest['messages'],
  });
  throwIfAborted(signal);
  const decision = extractOpenAIMessageFromJson(decisionPayload);
  const searchRequest = parseTextProtocolSearchRequest(decision.content);

  if (!searchRequest) {
    throwIfMissingVisibleAnswer(decision.content);
    addChatDebugLog('web-search-text-protocol', 'json decision answered directly', {
      visibleChars: stripThinkingContent(decision.content).length,
    });
    emitChunk(onChunk, signal, decision.content);
    emitApiTranscript(onApiTranscript, signal, [
      buildFinalAssistantTranscriptMessage(decision.content, decision.reasoningContent),
    ]);
    return decision.content;
  }

  addChatDebugLog('web-search-text-protocol', 'json decision requested search', {
    query: searchRequest.query,
    reason: searchRequest.reason ?? '',
  });
  const {
    messages,
    statusHistory,
    sourceUrls,
  } = await buildTextProtocolSearchMessages({ body, query: searchRequest.query, client, onStatus, signal });

  emitChunk(onChunk, signal, withStatusPrefix(statusHistory, ''));
  const answerPayload = await requestJson({
    ...withoutTools(body),
    stream: false,
    messages: messages as ChatCompletionRequest['messages'],
  });
  throwIfAborted(signal);
  const answer = extractOpenAIMessageFromJson(answerPayload);
  const finalApiContent = withSourceLinks(answer.content, sourceUrls);
  throwIfMissingVisibleAnswer(finalApiContent);
  const finalContent = withStatusPrefix(statusHistory, finalApiContent);
  addChatDebugLog('web-search-text-protocol', 'json search answer completed', {
    statuses: statusHistory.map((status) => status.phase),
    sources: sourceUrls,
    finalChars: finalApiContent.length,
  });
  emitChunk(onChunk, signal, finalContent);
  emitApiTranscript(onApiTranscript, signal, [
    buildFinalAssistantTranscriptMessage(finalApiContent, answer.reasoningContent),
  ]);
  return finalContent;
}

export async function runOpenAIWebSearchTextProtocolTextRequest({
  body,
  onChunk,
  onStatus,
  onApiTranscript,
  requestText,
  client,
  signal,
}: TextRequestProtocolOptions): Promise<string> {
  throwIfAborted(signal);
  addChatDebugLog('web-search-text-protocol', 'text decision request started', {
    messages: body.messages.length,
    latestUserText: getLatestUserText(body).slice(0, 240),
  });
  const decisionMessages = [
    buildTextProtocolDecisionMessage(),
    ...body.messages as OpenAIWireMessage[],
  ];
  const decisionContent = await requestText({
    ...withoutTools(body),
    messages: decisionMessages as ChatCompletionRequest['messages'],
  }, () => {});
  throwIfAborted(signal);
  const searchRequest = parseTextProtocolSearchRequest(decisionContent);

  if (!searchRequest) {
    throwIfMissingVisibleAnswer(decisionContent);
    addChatDebugLog('web-search-text-protocol', 'text decision answered directly', {
      visibleChars: stripThinkingContent(decisionContent).length,
    });
    emitChunk(onChunk, signal, decisionContent);
    emitApiTranscript(onApiTranscript, signal, [
      buildFinalAssistantTranscriptMessage(stripThinkingContent(decisionContent)),
    ]);
    return decisionContent;
  }

  addChatDebugLog('web-search-text-protocol', 'text decision requested search', {
    query: searchRequest.query,
    reason: searchRequest.reason ?? '',
  });
  const {
    messages,
    statusHistory,
    sourceUrls,
  } = await buildTextProtocolSearchMessages({ body, query: searchRequest.query, client, onStatus, signal });

  emitChunk(onChunk, signal, withStatusPrefix(statusHistory, ''));
  const answerContent = await requestText({
    ...withoutTools(body),
    messages: messages as ChatCompletionRequest['messages'],
  }, (content) => {
    emitChunk(onChunk, signal, withStatusPrefix(statusHistory, content));
  });
  throwIfAborted(signal);
  const finalApiContent = withSourceLinks(stripThinkingContent(answerContent), sourceUrls);
  throwIfMissingVisibleAnswer(finalApiContent);
  const finalContent = withStatusPrefix(statusHistory, finalApiContent);
  addChatDebugLog('web-search-text-protocol', 'text search answer completed', {
    statuses: statusHistory.map((status) => status.phase),
    sources: sourceUrls,
    finalChars: finalApiContent.length,
  });
  emitChunk(onChunk, signal, finalContent);
  emitApiTranscript(onApiTranscript, signal, [
    buildFinalAssistantTranscriptMessage(finalApiContent),
  ]);
  return finalContent;
}

export async function runOpenAIWebSearchToolLoop({
  body,
  onChunk,
  request,
  client,
  onStatus,
  onApiTranscript,
  signal,
}: ToolLoopOptions): Promise<string> {
  let latestResultsStatus: WebSearchStatus | null = null;
  const statusHistory: WebSearchStatus[] = [];
  const sourceUrls: string[] = [];
  let latestContent = '';
  let latestAssistantApiContent = '';
  let latestReasoningContent = '';
  let latestResultsHaveSuccessfulRead = false;
  let forcedReadExhausted = false;
  let forcedReadAttemptedUrls = new Set<string>();
  let messages = appendWebSearchSystemInstruction(body.messages as OpenAIWireMessage[]);
  const responseTranscript: OpenAIWireMessage[] = [];
  const readContentByUrl = new Map<string, string>();
  const emitStatus = (status: WebSearchStatus) => {
    const safeStatus = sanitizeWebSearchStatus(status);
    if (!safeStatus) return;
    if (safeStatus.phase === 'results' && (safeStatus.results?.length ?? 0) > 0) {
      latestResultsStatus = safeStatus;
      latestResultsHaveSuccessfulRead = false;
      forcedReadExhausted = false;
      forcedReadAttemptedUrls = new Set();
    }
    if (hasSuccessfulRead(safeStatus)) {
      latestResultsHaveSuccessfulRead = true;
    }
    statusHistory.push(safeStatus);
    appendSuccessfulReadSources(sourceUrls, safeStatus);
    emitWebSearchStatus(onStatus, signal, safeStatus);
    emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
  };
  const emitContent = (content: string) => {
    latestContent = content;
    emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
  };

  for (let loopIndex = 0; loopIndex < MAX_WEB_SEARCH_TOOL_LOOPS; loopIndex += 1) {
    throwIfAborted(signal);
    if (shouldStopNoResultSearchLoop(statusHistory)) {
      addChatDebugLog('web-search-loop', 'stream no-result search cap reached', {
        loopIndex,
        attempts: countNoResultSearchAttempts(statusHistory),
      }, 'warn');
      return finishNoResultSearchLocally({
        body,
        statusHistory,
        onChunk,
        onApiTranscript,
        signal,
      });
    }
    const loopStartedAt = Date.now();
    addChatDebugLog('web-search-loop', 'stream loop request started', {
      loopIndex,
      messages: messages.length,
      hasResults: Boolean(latestResultsStatus),
      successfulRead: latestResultsHaveSuccessfulRead,
    });
    const response = await request({
      ...body,
      messages: messages as ChatCompletionRequest['messages'],
      tools: buildWebSearchTools(),
    });
    const result = await consumeOpenAIStreamWithTools(response, emitContent, { signal });
    throwIfAborted(signal);
    latestAssistantApiContent = result.assistantContent;
    latestReasoningContent = result.reasoningContent;
    addChatDebugLog('web-search-loop', 'stream loop response parsed', {
      loopIndex,
      durationMs: Date.now() - loopStartedAt,
      toolCalls: result.toolCalls.map((call) => call.function.name),
      visibleChars: result.assistantContent.length,
      reasoningChars: result.reasoningContent.length,
    });

    if (result.toolCalls.length === 0) {
      if (latestResultsStatus && shouldRequirePageRead(latestResultsStatus, latestResultsHaveSuccessfulRead, forcedReadExhausted)) {
        const forcedRead = await appendForcedReadMessages(
          messages,
          latestResultsStatus,
          loopIndex,
          { client, onStatus: emitStatus, signal },
          forcedReadAttemptedUrls,
        );
        throwIfAborted(signal);
        addChatDebugLog('web-search-loop', 'forced page read appended', {
          loopIndex,
          attemptedUrls: forcedRead.attemptedUrls,
          exhausted: forcedRead.exhausted,
        });
        forcedReadExhausted = forcedRead.exhausted;
        messages = forcedRead.messages;
        responseTranscript.push(...forcedRead.addedMessages);
        latestContent = '';
        emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
        continue;
      }
      const visibleAnswerContent = result.assistantContent || stripThinkingContent(result.content);
      if (!hasVisibleAnswerContent(visibleAnswerContent) && loopIndex < MAX_WEB_SEARCH_TOOL_LOOPS - 1) {
        const reminderMessage = buildVisibleAnswerReminderMessage();
        addChatDebugLog('web-search-loop', 'visible answer reminder appended', {
          loopIndex,
          mode: 'stream',
        }, 'warn');
        messages = [...messages, reminderMessage];
        responseTranscript.push(reminderMessage);
        latestContent = '';
        latestAssistantApiContent = '';
        latestReasoningContent = '';
        emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
        continue;
      }
      if (!hasVisibleAnswerContent(visibleAnswerContent)) {
        return recoverStreamingVisibleAnswer({
          body,
          messages,
          statusHistory,
          sourceUrls,
          request,
          onChunk,
          onApiTranscript,
          responseTranscript,
          signal,
        });
      }
      throwIfMissingVisibleAnswer(visibleAnswerContent);
      const finalContent = withSourceLinks(result.content, sourceUrls);
      addChatDebugLog('web-search-loop', 'stream loop completed', {
        loopIndex,
        sourceUrls,
        finalChars: finalContent.length,
      });
      const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
      responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
      emitApiTranscript(onApiTranscript, signal, responseTranscript);
      return withStatusPrefix(statusHistory, finalContent);
    }

    const visibleAnswerWithToolCalls = result.assistantContent || stripThinkingContent(result.content);
    if (
      hasAnySearchResults(statusHistory) &&
      hasVisibleAnswerContent(visibleAnswerWithToolCalls) &&
      hasOnlySearchToolCalls(result.toolCalls)
    ) {
      const finalContent = withSourceLinks(result.content, sourceUrls);
      addChatDebugLog('web-search-loop', 'stream loop completed with visible answer despite redundant tool calls', {
        loopIndex,
        sourceUrls,
        skippedToolCalls: result.toolCalls.map((call) => call.function.name),
        finalChars: finalContent.length,
      }, 'warn');
      const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
      responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
      emitApiTranscript(onApiTranscript, signal, responseTranscript);
      return withStatusPrefix(statusHistory, finalContent);
    }

    const assistantToolMessage = buildAssistantToolMessage(result);
    if (hasOnlyAlreadyReadToolCalls(result.toolCalls, readContentByUrl)) {
      const toolMessages = buildCachedReadToolMessages(result.toolCalls, readContentByUrl);
      addChatDebugLog('web-search-loop', 'reused cached page read for redundant tool calls', {
        loopIndex,
        urls: result.toolCalls.flatMap(getReadToolUrls),
      });
      messages = [
        ...messages,
        assistantToolMessage,
        ...toolMessages,
      ];
      responseTranscript.push(assistantToolMessage, ...toolMessages);
      latestContent = '';
      emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
      continue;
    }
    addChatDebugLog('web-search-loop', 'running tool calls', {
      loopIndex,
      toolCalls: result.toolCalls.map((call) => ({
        id: call.id,
        name: call.function.name,
      })),
    });
    const toolMessages = await runToolCallsInParallel(result.toolCalls, { client, onStatus: emitStatus, signal });
    throwIfAborted(signal);
    cacheReadContentForToolMessages(readContentByUrl, result.toolCalls, toolMessages);
    messages = [
      ...messages,
      assistantToolMessage,
      ...toolMessages,
    ];
    responseTranscript.push(assistantToolMessage, ...toolMessages);
  }

  if (!hasVisibleAnswerContent(latestAssistantApiContent || stripThinkingContent(latestContent))) {
    addChatDebugLog('web-search-loop', 'stream fallback recovery started', {
      loops: MAX_WEB_SEARCH_TOOL_LOOPS,
      sourceUrls,
    }, 'warn');
    return recoverStreamingVisibleAnswer({
      body,
      messages,
      statusHistory,
      sourceUrls,
      request,
      onChunk,
      onApiTranscript,
      responseTranscript,
      signal,
    });
  }
  throwIfMissingVisibleAnswer(latestAssistantApiContent || stripThinkingContent(latestContent));
  throwIfAborted(signal);
  const fallbackContent = withSourceLinks(latestContent, sourceUrls);
  const fallbackApiContent = withSourceLinks(latestAssistantApiContent, sourceUrls);
  responseTranscript.push(buildFinalAssistantTranscriptMessage(fallbackApiContent, latestReasoningContent));
  emitApiTranscript(onApiTranscript, signal, responseTranscript);
  return withStatusPrefix(statusHistory, fallbackContent);
}

export async function runOpenAIWebSearchJsonToolLoop({
  body,
  onChunk,
  requestJson,
  client,
  onStatus,
  onApiTranscript,
  signal,
  autoReadAfterSearch,
}: JsonToolLoopOptions): Promise<string> {
  let latestResultsStatus: WebSearchStatus | null = null;
  const statusHistory: WebSearchStatus[] = [];
  const sourceUrls: string[] = [];
  let latestContent = '';
  let latestReasoningContent = '';
  let latestResultsHaveSuccessfulRead = false;
  let forcedReadExhausted = false;
  let forcedReadAttemptedUrls = new Set<string>();
  let messages = appendWebSearchSystemInstruction(body.messages as OpenAIWireMessage[]);
  const responseTranscript: OpenAIWireMessage[] = [];
  const readContentByUrl = new Map<string, string>();
  const emitStatus = (status: WebSearchStatus) => {
    const safeStatus = sanitizeWebSearchStatus(status);
    if (!safeStatus) return;
    if (safeStatus.phase === 'results' && (safeStatus.results?.length ?? 0) > 0) {
      latestResultsStatus = safeStatus;
      latestResultsHaveSuccessfulRead = false;
      forcedReadExhausted = false;
      forcedReadAttemptedUrls = new Set();
    }
    if (hasSuccessfulRead(safeStatus)) {
      latestResultsHaveSuccessfulRead = true;
    }
    statusHistory.push(safeStatus);
    appendSuccessfulReadSources(sourceUrls, safeStatus);
    emitWebSearchStatus(onStatus, signal, safeStatus);
    emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
  };

  for (let loopIndex = 0; loopIndex < MAX_WEB_SEARCH_TOOL_LOOPS; loopIndex += 1) {
    throwIfAborted(signal);
    if (shouldStopNoResultSearchLoop(statusHistory)) {
      addChatDebugLog('web-search-loop', 'json no-result search cap reached', {
        loopIndex,
        attempts: countNoResultSearchAttempts(statusHistory),
      }, 'warn');
      return finishNoResultSearchLocally({
        body,
        statusHistory,
        onChunk,
        onApiTranscript,
        signal,
      });
    }
    const loopStartedAt = Date.now();
    addChatDebugLog('web-search-loop', 'json loop request started', {
      loopIndex,
      messages: messages.length,
      hasResults: Boolean(latestResultsStatus),
      successfulRead: latestResultsHaveSuccessfulRead,
    });
    const shouldDisableToolsForFinalAnswer = autoReadAfterSearch === true && latestResultsHaveSuccessfulRead;
    const requestMessages = shouldDisableToolsForFinalAnswer
      ? [...messages, buildVisibleAnswerReminderMessage()]
      : messages;
    const payload = await requestJson({
      ...(shouldDisableToolsForFinalAnswer ? withoutTools(body) : body),
      stream: false,
      messages: requestMessages as ChatCompletionRequest['messages'],
      ...(shouldDisableToolsForFinalAnswer ? {} : { tools: buildWebSearchTools() }),
    });
    throwIfAborted(signal);
    const result = extractOpenAIMessageFromJson(payload);
    latestContent = result.content;
    latestReasoningContent = result.reasoningContent;
    addChatDebugLog('web-search-loop', 'json loop response parsed', {
      loopIndex,
      durationMs: Date.now() - loopStartedAt,
      toolCalls: result.toolCalls.map((call) => call.function.name),
      visibleChars: result.content.length,
      reasoningChars: result.reasoningContent.length,
    });

    if (result.toolCalls.length === 0) {
      if (latestResultsStatus && shouldRequirePageRead(latestResultsStatus, latestResultsHaveSuccessfulRead, forcedReadExhausted)) {
        const forcedRead = await appendForcedReadMessages(
          messages,
          latestResultsStatus,
          loopIndex,
          { client, onStatus: emitStatus, signal, autoReadAfterSearch },
          forcedReadAttemptedUrls,
        );
        throwIfAborted(signal);
        addChatDebugLog('web-search-loop', 'forced page read appended', {
          loopIndex,
          attemptedUrls: forcedRead.attemptedUrls,
          exhausted: forcedRead.exhausted,
        });
        forcedReadExhausted = forcedRead.exhausted;
        messages = forcedRead.messages;
        responseTranscript.push(...forcedRead.addedMessages);
        latestContent = '';
        emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
        continue;
      }
      if (!hasVisibleAnswerContent(latestContent) && loopIndex < MAX_WEB_SEARCH_TOOL_LOOPS - 1) {
        const reminderMessage = buildVisibleAnswerReminderMessage();
        addChatDebugLog('web-search-loop', 'visible answer reminder appended', {
          loopIndex,
          mode: 'json',
        }, 'warn');
        messages = [...messages, reminderMessage];
        responseTranscript.push(reminderMessage);
        latestContent = '';
        latestReasoningContent = '';
        emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
        continue;
      }
      if (!hasVisibleAnswerContent(latestContent)) {
        return recoverJsonVisibleAnswer({
          body,
          messages,
          statusHistory,
          sourceUrls,
          requestJson,
          onChunk,
          onApiTranscript,
          responseTranscript,
          signal,
        });
      }
      throwIfMissingVisibleAnswer(latestContent);
      const finalAnswerContent = withSourceLinks(latestContent, sourceUrls);
      addChatDebugLog('web-search-loop', 'json loop completed', {
        loopIndex,
        sourceUrls,
        finalChars: finalAnswerContent.length,
      });
      const finalContent = withStatusPrefix(statusHistory, finalAnswerContent);
      const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
      responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
      emitApiTranscript(onApiTranscript, signal, responseTranscript);
      emitChunk(onChunk, signal, finalContent);
      return finalContent;
    }

    if (
      hasAnySearchResults(statusHistory) &&
      hasVisibleAnswerContent(latestContent) &&
      hasOnlySearchToolCalls(result.toolCalls)
    ) {
      const finalAnswerContent = withSourceLinks(latestContent, sourceUrls);
      addChatDebugLog('web-search-loop', 'json loop completed with visible answer despite redundant tool calls', {
        loopIndex,
        sourceUrls,
        skippedToolCalls: result.toolCalls.map((call) => call.function.name),
        finalChars: finalAnswerContent.length,
      }, 'warn');
      const finalContent = withStatusPrefix(statusHistory, finalAnswerContent);
      const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
      responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
      emitApiTranscript(onApiTranscript, signal, responseTranscript);
      emitChunk(onChunk, signal, finalContent);
      return finalContent;
    }

    const assistantToolMessage = buildAssistantToolMessage(result);
    if (hasOnlyAlreadyReadToolCalls(result.toolCalls, readContentByUrl)) {
      const toolMessages = buildCachedReadToolMessages(result.toolCalls, readContentByUrl);
      addChatDebugLog('web-search-loop', 'reused cached page read for redundant tool calls', {
        loopIndex,
        urls: result.toolCalls.flatMap(getReadToolUrls),
      });
      messages = [
        ...messages,
        assistantToolMessage,
        ...toolMessages,
      ];
      responseTranscript.push(assistantToolMessage, ...toolMessages);
      latestContent = '';
      emitChunk(onChunk, signal, withStatusPrefix(statusHistory, latestContent));
      continue;
    }
    addChatDebugLog('web-search-loop', 'running tool calls', {
      loopIndex,
      toolCalls: result.toolCalls.map((call) => ({
        id: call.id,
        name: call.function.name,
      })),
    });
    const toolMessages = await runToolCallsInParallel(result.toolCalls, {
      client,
      onStatus: emitStatus,
      signal,
      autoReadAfterSearch,
    });
    throwIfAborted(signal);
    cacheReadContentForToolMessages(readContentByUrl, result.toolCalls, toolMessages);
    messages = [
      ...messages,
      assistantToolMessage,
      ...toolMessages,
    ];
    responseTranscript.push(assistantToolMessage, ...toolMessages);
  }

  if (!hasVisibleAnswerContent(latestContent)) {
    addChatDebugLog('web-search-loop', 'json fallback recovery started', {
      loops: MAX_WEB_SEARCH_TOOL_LOOPS,
      sourceUrls,
    }, 'warn');
    return recoverJsonVisibleAnswer({
      body,
      messages,
      statusHistory,
      sourceUrls,
      requestJson,
      onChunk,
      onApiTranscript,
      responseTranscript,
      signal,
    });
  }
  throwIfMissingVisibleAnswer(latestContent);
  throwIfAborted(signal);
  const fallbackAnswerContent = withSourceLinks(latestContent, sourceUrls);
  responseTranscript.push(buildFinalAssistantTranscriptMessage(fallbackAnswerContent, latestReasoningContent));
  emitApiTranscript(onApiTranscript, signal, responseTranscript);
  const fallbackContent = withStatusPrefix(statusHistory, fallbackAnswerContent);
  emitChunk(onChunk, signal, fallbackContent);
  return fallbackContent;
}
