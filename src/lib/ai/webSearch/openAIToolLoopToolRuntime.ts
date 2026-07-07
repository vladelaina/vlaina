import { sanitizeWebSearchSourceUrl } from './statusMarkup';
import { WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';
import { runWebSearchToolCall, type WebSearchToolRunnerOptions } from './toolRunner';
import type { WebSearchStatus } from './types';
import type { OpenAIToolCall, OpenAIWireMessage } from './openAIToolTypes';
import { MAX_PARALLEL_WEB_SEARCH_TOOL_CALLS } from './openAIToolLoopTypes';
import { buildReadReminderMessage } from './openAIToolLoopShared';
import {
  buildToolCallDedupeKey,
  parseToolArguments,
} from './openAIToolLoopToolArgs';

export function collectUniqueSearchResultUrls(
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

export function getPrefetchReadUrls(status: WebSearchStatus): string[] {
  return collectUniqueSearchResultUrls(status, { limit: 3 });
}

export function buildForcedReadToolCall(
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

export function getReadableResultUrls(status: WebSearchStatus): string[] {
  return collectUniqueSearchResultUrls(status);
}

export function buildAssistantToolMessage(result: {
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

export async function runToolCallsInParallel(
  toolCalls: OpenAIToolCall[],
  options: WebSearchToolRunnerOptions,
): Promise<OpenAIWireMessage[]> {
  const uniqueCalls: Array<{
    key: string;
    toolCall: OpenAIToolCall;
    contentPromise?: Promise<string>;
  }> = [];
  const callsByKey = new Map<string, typeof uniqueCalls[number]>();
  const callsByIndex = new Array<typeof uniqueCalls[number]>(toolCalls.length);

  for (let index = 0; index < toolCalls.length; index += 1) {
    const toolCall = toolCalls[index];
    const key = buildToolCallDedupeKey(toolCall);
    let uniqueCall = callsByKey.get(key);
    if (!uniqueCall) {
      uniqueCall = { key, toolCall };
      callsByKey.set(key, uniqueCall);
      uniqueCalls.push(uniqueCall);
    }
    callsByIndex[index] = uniqueCall;
  }

  let nextUniqueIndex = 0;

  const worker = async () => {
    while (nextUniqueIndex < uniqueCalls.length) {
      const index = nextUniqueIndex;
      nextUniqueIndex += 1;
      const uniqueCall = uniqueCalls[index];
      uniqueCall.contentPromise = runWebSearchToolCall(uniqueCall.toolCall.function, options);
      await uniqueCall.contentPromise;
    }
  };

  await Promise.all(Array.from(
    { length: Math.min(MAX_PARALLEL_WEB_SEARCH_TOOL_CALLS, uniqueCalls.length) },
    () => worker(),
  ));

  const contents = await Promise.all(callsByIndex.map(async (uniqueCall) => {
    if (!uniqueCall.contentPromise) {
      uniqueCall.contentPromise = runWebSearchToolCall(uniqueCall.toolCall.function, options);
    }
    return await uniqueCall.contentPromise;
  }));

  return toolCalls.map((toolCall, index) => ({
    role: 'tool',
    tool_call_id: toolCall.id,
    name: toolCall.function.name,
    content: contents[index],
  }));
}

export async function appendForcedReadMessages(
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
