import type { ChatCompletionRequest } from '@/lib/ai/types';
import { buildWebSearchStatusMarkup } from './statusMarkup';
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
  extractOpenAIMessageFromJson,
} from './openAIToolParsing';
import type { OpenAIToolCall, OpenAIWireMessage } from './openAIToolTypes';

const MAX_WEB_SEARCH_TOOL_LOOPS = 6;
const NEWS_FAST_PATH_READ_LIMIT = 2;
const NEWS_FAST_PATH_CONTENT_LIMIT = 1200;
const NEWS_FAST_PATH_MAX_COMPLETION_TOKENS = 500;
const NEWS_FAST_PATH_SOURCES = [
  {
    title: 'AP News World News',
    url: 'https://apnews.com/hub/world-news',
    snippet: 'Associated Press world news coverage.',
  },
  {
    title: 'CNN International',
    url: 'https://edition.cnn.com/world',
    snippet: 'CNN international and world news coverage.',
  },
  {
    title: 'Reuters World News',
    url: 'https://www.reuters.com/world/',
    snippet: 'Reuters world news and international headlines.',
  },
  {
    title: 'BBC World News',
    url: 'https://www.bbc.com/news/world',
    snippet: 'BBC world news headlines and explainers.',
  },
];

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

interface StreamingPrefetchOptions extends PrefetchOptions {
  request: (body: ChatCompletionRequest) => Promise<Response>;
}

interface JsonPrefetchOptions extends PrefetchOptions {
  requestJson: (body: ChatCompletionRequest) => Promise<Record<string, unknown>>;
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

function appendSuccessfulReadSources(target: string[], status: WebSearchStatus): void {
  if (!hasSuccessfulRead(status)) return;
  for (const url of status.urls ?? []) {
    if (typeof url !== 'string' || url.trim().length === 0) continue;
    if (!target.includes(url)) target.push(url);
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
    content: 'Read at least one relevant result page before answering from search results.',
  };
}

function buildVisibleAnswerReminderMessage(): OpenAIWireMessage {
  return {
    role: 'system',
    content: 'Write the final answer now using the search/page-read context already provided. Do not call tools. Include source links when available.',
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

function hasOnlySearchToolCalls(toolCalls: OpenAIToolCall[]): boolean {
  return toolCalls.length > 0 && toolCalls.every((call) => isSearchToolName(call.function.name));
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

function shouldUseNewsFastPath(text: string): boolean {
  const normalized = text.toLowerCase();
  const compact = normalized.replace(/\s+/g, '');
  const asksNews = /(\b(news|headlines|breaking)\b|actualité|actualités|noticias|notícias|notizie|nachrichten|новост|أخبار|समाचार)/i.test(normalized)
    || /(新闻|資訊|资讯|快訊|快讯|頭條|头条|ニュース|뉴스)/i.test(compact);
  const asksWorldScope = /(\b(world|international|global|foreign)\b|internationales?|internacionales?|internacionais?|internazionali|internationale|monde|mondo|welt|международ|عالمية|دولية|अंतरराष्ट्रीय|विश्व)/i.test(normalized)
    || /(国际|國際|世界|全球|国外|國外|海外|国際|국제|세계)/i.test(compact);
  return asksNews && asksWorldScope;
}

function buildNewsFastPathQuery(text: string): string {
  return /[\u3400-\u9fff]/.test(text)
    ? 'international world news today AP CNN'
    : text;
}

function buildNewsFastPathPrompt({
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
      'Answer from the provided web search context. Do not call tools.',
      'For news, use 4-6 concise bullets in the user language and include source links.',
      'If evidence is limited, answer first, then briefly note the limitation.',
      '',
      `User request: ${userText}`,
      '',
      'Search results:',
      searchContent,
      '',
      'Read page content:',
      pageContent || '(No pages were readable; use the search results only and say so briefly.)',
    ].join('\n'),
  };
}

function buildPrefetchedWebSearchPrompt({
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
      'Answer from the provided web search context. Do not call tools.',
      'Include source links when available. If evidence is limited, answer first, then briefly note the limitation.',
      '',
      `User request: ${userText}`,
      '',
      'Search results:',
      searchContent,
      '',
      'Read page content:',
      pageContent || '(No pages were readable; use the search results only and say so briefly.)',
    ].join('\n'),
  };
}

function elapsedSince(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function getPrefetchReadUrls(status: WebSearchStatus): string[] {
  return (status.results ?? [])
    .map((result) => result.url)
    .filter((url, index, urls): url is string => typeof url === 'string' && url.trim().length > 0 && urls.indexOf(url) === index)
    .slice(0, 3);
}

async function buildPrefetchedWebSearchMessages({
  body,
  client: providedClient,
  onStatus,
  signal,
}: Pick<PrefetchOptions, 'body' | 'client' | 'onStatus' | 'signal'>): Promise<{
  messages: OpenAIWireMessage[];
  statusHistory: WebSearchStatus[];
  sourceUrls: string[];
}> {
  const client = providedClient ?? createWebSearchClient();
  const userText = getLatestUserText(body);
  const statusHistory: WebSearchStatus[] = [];
  const sourceUrls: string[] = [];
  const emitStatus = (status: WebSearchStatus) => {
    statusHistory.push(status);
    appendSuccessfulReadSources(sourceUrls, status);
    onStatus?.(status);
  };

  throwIfAborted(signal);
  const searchStartedAt = performance.now();
  emitStatus({ phase: 'searching', query: userText });
  const searchResponse = signal
    ? await client.webSearch(userText, { limit: 5 }, signal)
    : await client.webSearch(userText, { limit: 5 });
  throwIfAborted(signal);
  const resultsStatus: WebSearchStatus = {
    phase: searchResponse.results.length > 0 ? 'results' : 'error',
    query: searchResponse.query,
    results: searchResponse.results.slice(0, 5),
    metrics: {
      durationMs: elapsedSince(searchStartedAt),
      resultCount: searchResponse.results.length,
    },
    message: searchResponse.results.length > 0 ? undefined : 'No relevant results were found.',
  };
  emitStatus(resultsStatus);

  const urls = getPrefetchReadUrls(resultsStatus);
  let pageContent = '';
  if (urls.length > 0) {
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
  }

  return {
    messages: [
      ...body.messages as OpenAIWireMessage[],
      buildPrefetchedWebSearchPrompt({
        userText,
        searchContent: formatSearchResultsForModel(searchResponse),
        pageContent,
      }),
    ],
    statusHistory,
    sourceUrls,
  };
}

function topResultUrls(status: WebSearchStatus | null): string[] {
  return (status?.results ?? [])
    .map((result) => result.url)
    .filter((url, index, urls) => typeof url === 'string' && url.trim().length > 0 && urls.indexOf(url) === index)
    .slice(0, NEWS_FAST_PATH_READ_LIMIT);
}

function buildNewsFastPathSourceStatus(): WebSearchStatus {
  return {
    phase: 'results',
    query: 'trusted international news sources',
    results: NEWS_FAST_PATH_SOURCES.map((source) => ({
      title: source.title,
      url: source.url,
      snippet: source.snippet,
      publishedAt: null,
    })),
    metrics: {
      resultCount: NEWS_FAST_PATH_SOURCES.length,
    },
  };
}

function buildCuratedNewsSearchContent(): string {
  return [
    'Search query: trusted international news sources',
    'Candidate sources:',
    ...NEWS_FAST_PATH_SOURCES.flatMap((source, index) => [
      `${index + 1}. ${source.title}`,
      `URL: ${source.url}`,
      `Summary: ${source.snippet}`,
      'Time: (current source homepage)',
      'Source: curated-news-fast-path',
    ]),
  ].join('\n');
}

function withFastPathCompletionLimit(body: ChatCompletionRequest): ChatCompletionRequest {
  const base = withoutTools(body);
  if (typeof base.max_completion_tokens === 'number' || typeof base.max_tokens === 'number') {
    return base;
  }
  return {
    ...base,
    max_completion_tokens: NEWS_FAST_PATH_MAX_COMPLETION_TOKENS,
  };
}

function buildForcedReadToolCall(
  status: WebSearchStatus,
  loopIndex: number,
  attemptedUrls: Set<string>,
): OpenAIToolCall | null {
  const urls = (status.results ?? [])
    .map((result) => result.url)
    .filter((url) => typeof url === 'string' && url.trim().length > 0)
    .filter((url, index, allUrls) => allUrls.indexOf(url) === index)
    .filter((url) => !attemptedUrls.has(url))
    .slice(0, 3);

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
  return (status.results ?? [])
    .map((result) => result.url)
    .filter((url) => typeof url === 'string' && url.trim().length > 0)
    .filter((url, index, allUrls) => allUrls.indexOf(url) === index);
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

  const urls = JSON.parse(toolCall.function.arguments).urls as string[];
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
    messages: [...messages, reminderMessage] as ChatCompletionRequest['messages'],
  });
  const result = await consumeOpenAIStreamWithTools(response, (content) => {
    onChunk(withStatusPrefix(statusHistory, content));
  });
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
  onApiTranscript?.(responseTranscript);
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
  const result = extractOpenAIMessageFromJson(await requestJson({
    ...withoutTools(body),
    stream: false,
    messages: [...messages, reminderMessage] as ChatCompletionRequest['messages'],
  }));
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
  onApiTranscript?.(responseTranscript);
  onChunk(finalContent);
  return finalContent;
}

async function runStreamingNewsFastPath({
  body,
  onChunk,
  request,
  client,
  onStatus,
  onApiTranscript,
  signal,
  userText,
}: ToolLoopOptions & { userText: string }): Promise<string> {
  const statusHistory: WebSearchStatus[] = [];
  const sourceUrls: string[] = [];
  let latestResultsStatus: WebSearchStatus | null = null;
  let latestContent = '';
  const emitStatus = (status: WebSearchStatus) => {
    if (status.phase === 'results') {
      latestResultsStatus = status;
    }
    statusHistory.push(status);
    appendSuccessfulReadSources(sourceUrls, status);
    onStatus?.(status);
    onChunk(withStatusPrefix(statusHistory, latestContent));
  };

  const startedAt = Date.now();
  addChatDebugLog('web-search-fast-path', 'stream news fast path started', {
    query: userText,
  });
  emitStatus({ phase: 'searching', query: buildNewsFastPathQuery(userText) });
  const curatedResultsStatus = buildNewsFastPathSourceStatus();
  emitStatus(curatedResultsStatus);
  latestResultsStatus = curatedResultsStatus;
  const searchContent = buildCuratedNewsSearchContent();
  const urls = topResultUrls(latestResultsStatus);
  const readStartedAt = Date.now();
  const pageContent = urls.length > 0
    ? await runWebSearchToolCall({
      name: WEB_SEARCH_TOOL_NAMES.readBatch,
      arguments: JSON.stringify({ urls, contentLimit: NEWS_FAST_PATH_CONTENT_LIMIT }),
    }, { client, onStatus: emitStatus, signal })
    : '';
  const readDurationMs = Date.now() - readStartedAt;
  const sourceMessage = buildNewsFastPathPrompt({ userText, searchContent, pageContent });
  const responseTranscript: OpenAIWireMessage[] = [sourceMessage];
  const modelStartedAt = Date.now();
  const response = await request({
    ...withFastPathCompletionLimit(body),
    messages: [...body.messages, sourceMessage] as ChatCompletionRequest['messages'],
  });
  const result = await consumeOpenAIStreamWithTools(response, (content) => {
    latestContent = content;
    onChunk(withStatusPrefix(statusHistory, latestContent));
  });
  const visibleAnswerContent = result.assistantContent || stripThinkingContent(result.content);
  throwIfMissingVisibleAnswer(visibleAnswerContent);
  const finalContent = withSourceLinks(result.content, sourceUrls);
  const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
  responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
  onApiTranscript?.(responseTranscript);
  addChatDebugLog('web-search-fast-path', 'stream news fast path completed', {
    durationMs: Date.now() - startedAt,
    readDurationMs,
    modelDurationMs: Date.now() - modelStartedAt,
    readUrls: urls,
    sourceUrls,
    finalChars: finalContent.length,
    curatedSources: true,
  });
  return withStatusPrefix(statusHistory, finalContent);
}

async function runJsonNewsFastPath({
  body,
  onChunk,
  requestJson,
  client,
  onStatus,
  onApiTranscript,
  signal,
  userText,
}: JsonToolLoopOptions & { userText: string }): Promise<string> {
  const statusHistory: WebSearchStatus[] = [];
  const sourceUrls: string[] = [];
  let latestResultsStatus: WebSearchStatus | null = null;
  let latestContent = '';
  const emitStatus = (status: WebSearchStatus) => {
    if (status.phase === 'results') {
      latestResultsStatus = status;
    }
    statusHistory.push(status);
    appendSuccessfulReadSources(sourceUrls, status);
    onStatus?.(status);
    onChunk(withStatusPrefix(statusHistory, latestContent));
  };

  const startedAt = Date.now();
  addChatDebugLog('web-search-fast-path', 'json news fast path started', {
    query: userText,
  });
  emitStatus({ phase: 'searching', query: buildNewsFastPathQuery(userText) });
  const curatedResultsStatus = buildNewsFastPathSourceStatus();
  emitStatus(curatedResultsStatus);
  latestResultsStatus = curatedResultsStatus;
  const searchContent = buildCuratedNewsSearchContent();
  const urls = topResultUrls(latestResultsStatus);
  const readStartedAt = Date.now();
  const pageContent = urls.length > 0
    ? await runWebSearchToolCall({
      name: WEB_SEARCH_TOOL_NAMES.readBatch,
      arguments: JSON.stringify({ urls, contentLimit: NEWS_FAST_PATH_CONTENT_LIMIT }),
    }, { client, onStatus: emitStatus, signal })
    : '';
  const readDurationMs = Date.now() - readStartedAt;
  const sourceMessage = buildNewsFastPathPrompt({ userText, searchContent, pageContent });
  const responseTranscript: OpenAIWireMessage[] = [sourceMessage];
  const modelStartedAt = Date.now();
  const result = extractOpenAIMessageFromJson(await requestJson({
    ...withFastPathCompletionLimit(body),
    stream: false,
    messages: [...body.messages, sourceMessage] as ChatCompletionRequest['messages'],
  }));
  throwIfMissingVisibleAnswer(result.content);
  const finalAnswerContent = withSourceLinks(result.content, sourceUrls);
  latestContent = finalAnswerContent;
  const finalContent = withStatusPrefix(statusHistory, latestContent);
  const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
  responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
  onApiTranscript?.(responseTranscript);
  onChunk(finalContent);
  addChatDebugLog('web-search-fast-path', 'json news fast path completed', {
    durationMs: Date.now() - startedAt,
    readDurationMs,
    modelDurationMs: Date.now() - modelStartedAt,
    readUrls: urls,
    sourceUrls,
    finalChars: finalAnswerContent.length,
    curatedSources: true,
  });
  return finalContent;
}

export async function runOpenAIWebSearchPrefetchRequest({
  body,
  onChunk,
  onStatus,
  onApiTranscript,
  request,
  client,
  signal,
}: StreamingPrefetchOptions): Promise<string> {
  const {
    messages,
    statusHistory,
    sourceUrls,
  } = await buildPrefetchedWebSearchMessages({ body, client, onStatus, signal });
  let latestContent = '';
  const emitContent = (content: string) => {
    latestContent = content;
    onChunk(withStatusPrefix(statusHistory, latestContent));
  };

  onChunk(withStatusPrefix(statusHistory, latestContent));
  const response = await request({
    ...withoutTools(body),
    messages: messages as ChatCompletionRequest['messages'],
  });
  const result = await consumeOpenAIStreamWithTools(response, emitContent);
  const finalApiContent = withSourceLinks(result.assistantContent || result.content, sourceUrls);
  throwIfMissingVisibleAnswer(finalApiContent);
  const finalContent = withStatusPrefix(statusHistory, finalApiContent);
  onChunk(finalContent);
  onApiTranscript?.([buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent)]);
  return finalContent;
}

export async function runOpenAIWebSearchJsonPrefetchRequest({
  body,
  onChunk,
  onStatus,
  onApiTranscript,
  requestJson,
  client,
  signal,
}: JsonPrefetchOptions): Promise<string> {
  const {
    messages,
    statusHistory,
    sourceUrls,
  } = await buildPrefetchedWebSearchMessages({ body, client, onStatus, signal });

  onChunk(withStatusPrefix(statusHistory, ''));
  const result = extractOpenAIMessageFromJson(await requestJson({
    ...withoutTools(body),
    stream: false,
    messages: messages as ChatCompletionRequest['messages'],
  }));
  const finalApiContent = withSourceLinks(result.content, sourceUrls);
  throwIfMissingVisibleAnswer(finalApiContent);
  const finalContent = withStatusPrefix(statusHistory, finalApiContent);
  onChunk(finalContent);
  onApiTranscript?.([buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent)]);
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
  const latestUserText = getLatestUserText(body);
  if (shouldUseNewsFastPath(latestUserText)) {
    try {
      return await runStreamingNewsFastPath({
        body,
        onChunk,
        request,
        client,
        onStatus,
        onApiTranscript,
        signal,
        userText: latestUserText,
      });
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error;
      }
      addChatDebugLog('web-search-fast-path', 'stream news fast path failed; falling back to tool loop', {
        error: error instanceof Error ? error.message : String(error),
      }, 'warn');
    }
  }

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
  const emitStatus = (status: WebSearchStatus) => {
    if (status.phase === 'results' && (status.results?.length ?? 0) > 0) {
      latestResultsStatus = status;
      latestResultsHaveSuccessfulRead = false;
      forcedReadExhausted = false;
      forcedReadAttemptedUrls = new Set();
    }
    if (hasSuccessfulRead(status)) {
      latestResultsHaveSuccessfulRead = true;
    }
    statusHistory.push(status);
    appendSuccessfulReadSources(sourceUrls, status);
    onStatus?.(status);
    onChunk(withStatusPrefix(statusHistory, latestContent));
  };
  const emitContent = (content: string) => {
    latestContent = content;
    onChunk(withStatusPrefix(statusHistory, latestContent));
  };

  for (let loopIndex = 0; loopIndex < MAX_WEB_SEARCH_TOOL_LOOPS; loopIndex += 1) {
    throwIfAborted(signal);
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
    const result = await consumeOpenAIStreamWithTools(response, emitContent);
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
        addChatDebugLog('web-search-loop', 'forced page read appended', {
          loopIndex,
          attemptedUrls: forcedRead.attemptedUrls,
          exhausted: forcedRead.exhausted,
        });
        forcedReadExhausted = forcedRead.exhausted;
        messages = forcedRead.messages;
        responseTranscript.push(...forcedRead.addedMessages);
        latestContent = '';
        onChunk(withStatusPrefix(statusHistory, latestContent));
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
        onChunk(withStatusPrefix(statusHistory, latestContent));
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
      onApiTranscript?.(responseTranscript);
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
      onApiTranscript?.(responseTranscript);
      return withStatusPrefix(statusHistory, finalContent);
    }

    const assistantToolMessage = buildAssistantToolMessage(result);
    addChatDebugLog('web-search-loop', 'running tool calls', {
      loopIndex,
      toolCalls: result.toolCalls.map((call) => ({
        id: call.id,
        name: call.function.name,
      })),
    });
    const toolMessages = await runToolCallsInParallel(result.toolCalls, { client, onStatus: emitStatus, signal });
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
  const fallbackContent = withSourceLinks(latestContent, sourceUrls);
  const fallbackApiContent = withSourceLinks(latestAssistantApiContent, sourceUrls);
  responseTranscript.push(buildFinalAssistantTranscriptMessage(fallbackApiContent, latestReasoningContent));
  onApiTranscript?.(responseTranscript);
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
}: JsonToolLoopOptions): Promise<string> {
  const latestUserText = getLatestUserText(body);
  if (shouldUseNewsFastPath(latestUserText)) {
    try {
      return await runJsonNewsFastPath({
        body,
        onChunk,
        requestJson,
        client,
        onStatus,
        onApiTranscript,
        signal,
        userText: latestUserText,
      });
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error;
      }
      addChatDebugLog('web-search-fast-path', 'json news fast path failed; falling back to tool loop', {
        error: error instanceof Error ? error.message : String(error),
      }, 'warn');
    }
  }

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
  const emitStatus = (status: WebSearchStatus) => {
    if (status.phase === 'results' && (status.results?.length ?? 0) > 0) {
      latestResultsStatus = status;
      latestResultsHaveSuccessfulRead = false;
      forcedReadExhausted = false;
      forcedReadAttemptedUrls = new Set();
    }
    if (hasSuccessfulRead(status)) {
      latestResultsHaveSuccessfulRead = true;
    }
    statusHistory.push(status);
    appendSuccessfulReadSources(sourceUrls, status);
    onStatus?.(status);
    onChunk(withStatusPrefix(statusHistory, latestContent));
  };

  for (let loopIndex = 0; loopIndex < MAX_WEB_SEARCH_TOOL_LOOPS; loopIndex += 1) {
    throwIfAborted(signal);
    const loopStartedAt = Date.now();
    addChatDebugLog('web-search-loop', 'json loop request started', {
      loopIndex,
      messages: messages.length,
      hasResults: Boolean(latestResultsStatus),
      successfulRead: latestResultsHaveSuccessfulRead,
    });
    const payload = await requestJson({
      ...body,
      stream: false,
      messages: messages as ChatCompletionRequest['messages'],
      tools: buildWebSearchTools(),
    });
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
          { client, onStatus: emitStatus, signal },
          forcedReadAttemptedUrls,
        );
        addChatDebugLog('web-search-loop', 'forced page read appended', {
          loopIndex,
          attemptedUrls: forcedRead.attemptedUrls,
          exhausted: forcedRead.exhausted,
        });
        forcedReadExhausted = forcedRead.exhausted;
        messages = forcedRead.messages;
        responseTranscript.push(...forcedRead.addedMessages);
        latestContent = '';
        onChunk(withStatusPrefix(statusHistory, latestContent));
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
        onChunk(withStatusPrefix(statusHistory, latestContent));
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
      onApiTranscript?.(responseTranscript);
      onChunk(finalContent);
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
      onApiTranscript?.(responseTranscript);
      onChunk(finalContent);
      return finalContent;
    }

    const assistantToolMessage = buildAssistantToolMessage(result);
    addChatDebugLog('web-search-loop', 'running tool calls', {
      loopIndex,
      toolCalls: result.toolCalls.map((call) => ({
        id: call.id,
        name: call.function.name,
      })),
    });
    const toolMessages = await runToolCallsInParallel(result.toolCalls, { client, onStatus: emitStatus, signal });
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
  const fallbackAnswerContent = withSourceLinks(latestContent, sourceUrls);
  responseTranscript.push(buildFinalAssistantTranscriptMessage(fallbackAnswerContent, latestReasoningContent));
  onApiTranscript?.(responseTranscript);
  const fallbackContent = withStatusPrefix(statusHistory, fallbackAnswerContent);
  onChunk(fallbackContent);
  return fallbackContent;
}
