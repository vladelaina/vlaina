import type { ChatCompletionRequest } from '@/lib/ai/types';
import { buildWebSearchStatusMarkup } from './statusMarkup';
import { buildWebSearchTools, WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';
import { runWebSearchToolCall, type WebSearchToolRunnerOptions } from './toolRunner';
import type { WebSearchStatus } from './types';
import { consumeOpenAIStreamWithTools } from './openAIStreamWithTools';
import {
  appendWebSearchSystemInstruction,
  extractOpenAIMessageFromJson,
} from './openAIToolParsing';
import type { OpenAIToolCall, OpenAIWireMessage } from './openAIToolTypes';

const MAX_WEB_SEARCH_TOOL_LOOPS = 6;

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

function withStatusPrefix(statuses: WebSearchStatus[], content: string): string {
  if (statuses.length === 0) return content;
  const separator = content.trim().length > 0 ? '\n\n' : '';
  return `${statuses.map(buildWebSearchStatusMarkup).join('')}${separator}${content}`;
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
  forcedReadAttempted: boolean,
): boolean {
  return status?.phase === 'results'
    && !latestResultsHaveSuccessfulRead
    && !forcedReadAttempted
    && (status.results?.length ?? 0) > 0;
}

function buildReadReminderMessage(): OpenAIWireMessage {
  return {
    role: 'system',
    content:
      'You have search results, but you have not read any source page yet. Call read_web_page or read_web_pages on the relevant result URL before writing the final answer.',
  };
}

function buildForcedReadToolCall(status: WebSearchStatus, loopIndex: number): OpenAIToolCall | null {
  const urls = (status.results ?? [])
    .map((result) => result.url)
    .filter((url) => typeof url === 'string' && url.trim().length > 0)
    .slice(0, 2);

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

function buildAssistantToolMessage(result: {
  content: string;
  assistantContent?: string;
  reasoningContent?: string;
  toolCalls: OpenAIToolCall[];
}): OpenAIWireMessage {
  const message: OpenAIWireMessage = {
    role: 'assistant',
    content: (result.assistantContent ?? result.content) || null,
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
): Promise<{ messages: OpenAIWireMessage[]; addedMessages: OpenAIWireMessage[] }> {
  const toolCall = buildForcedReadToolCall(status, loopIndex);

  if (!toolCall) {
    const addedMessages = [buildReadReminderMessage()];
    return {
      messages: [...messages, ...addedMessages],
      addedMessages,
    };
  }

  const toolResult = await runWebSearchToolCall(toolCall.function, options);
  const addedMessages: OpenAIWireMessage[] = [
    {
      role: 'assistant',
      content: null,
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
  };
}

export async function runOpenAIWebSearchToolLoop({
  body,
  onChunk,
  request,
  client,
  onStatus,
  onApiTranscript,
}: ToolLoopOptions): Promise<string> {
  let latestResultsStatus: WebSearchStatus | null = null;
  const statusHistory: WebSearchStatus[] = [];
  const sourceUrls: string[] = [];
  let latestContent = '';
  let latestAssistantApiContent = '';
  let latestReasoningContent = '';
  let latestResultsHaveSuccessfulRead = false;
  let forcedReadAttempted = false;
  let messages = appendWebSearchSystemInstruction(body.messages as OpenAIWireMessage[]);
  const responseTranscript: OpenAIWireMessage[] = [];
  const emitStatus = (status: WebSearchStatus) => {
    if (status.phase === 'results' && (status.results?.length ?? 0) > 0) {
      latestResultsStatus = status;
      latestResultsHaveSuccessfulRead = false;
      forcedReadAttempted = false;
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
    const response = await request({
      ...body,
      messages: messages as ChatCompletionRequest['messages'],
      tools: buildWebSearchTools(),
      tool_choice: 'auto',
    });
    const result = await consumeOpenAIStreamWithTools(response, emitContent);
    latestAssistantApiContent = result.assistantContent;
    latestReasoningContent = result.reasoningContent;

    if (result.toolCalls.length === 0) {
      if (latestResultsStatus && shouldRequirePageRead(latestResultsStatus, latestResultsHaveSuccessfulRead, forcedReadAttempted)) {
        forcedReadAttempted = true;
        const forcedRead = await appendForcedReadMessages(
          messages,
          latestResultsStatus,
          loopIndex,
          { client, onStatus: emitStatus },
        );
        messages = forcedRead.messages;
        responseTranscript.push(...forcedRead.addedMessages);
        latestContent = '';
        onChunk(withStatusPrefix(statusHistory, latestContent));
        continue;
      }
      const finalContent = withSourceLinks(result.content, sourceUrls);
      const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
      responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
      onApiTranscript?.(responseTranscript);
      return withStatusPrefix(statusHistory, finalContent);
    }

    const assistantToolMessage = buildAssistantToolMessage(result);
    const toolMessages = await runToolCallsInParallel(result.toolCalls, { client, onStatus: emitStatus });
    messages = [
      ...messages,
      assistantToolMessage,
      ...toolMessages,
    ];
    responseTranscript.push(assistantToolMessage, ...toolMessages);
  }

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
}: JsonToolLoopOptions): Promise<string> {
  let latestResultsStatus: WebSearchStatus | null = null;
  const statusHistory: WebSearchStatus[] = [];
  const sourceUrls: string[] = [];
  let latestContent = '';
  let latestReasoningContent = '';
  let latestResultsHaveSuccessfulRead = false;
  let forcedReadAttempted = false;
  let messages = appendWebSearchSystemInstruction(body.messages as OpenAIWireMessage[]);
  const responseTranscript: OpenAIWireMessage[] = [];
  const emitStatus = (status: WebSearchStatus) => {
    if (status.phase === 'results' && (status.results?.length ?? 0) > 0) {
      latestResultsStatus = status;
      latestResultsHaveSuccessfulRead = false;
      forcedReadAttempted = false;
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
    const payload = await requestJson({
      ...body,
      stream: false,
      messages: messages as ChatCompletionRequest['messages'],
      tools: buildWebSearchTools(),
      tool_choice: 'auto',
    });
    const result = extractOpenAIMessageFromJson(payload);
    latestContent = result.content;
    latestReasoningContent = result.reasoningContent;

    if (result.toolCalls.length === 0) {
      if (latestResultsStatus && shouldRequirePageRead(latestResultsStatus, latestResultsHaveSuccessfulRead, forcedReadAttempted)) {
        forcedReadAttempted = true;
        const forcedRead = await appendForcedReadMessages(
          messages,
          latestResultsStatus,
          loopIndex,
          { client, onStatus: emitStatus },
        );
        messages = forcedRead.messages;
        responseTranscript.push(...forcedRead.addedMessages);
        latestContent = '';
        onChunk(withStatusPrefix(statusHistory, latestContent));
        continue;
      }
      const finalAnswerContent = withSourceLinks(latestContent, sourceUrls);
      const finalContent = withStatusPrefix(statusHistory, finalAnswerContent);
      const finalApiContent = resolveFinalAssistantApiContent(result, sourceUrls);
      responseTranscript.push(buildFinalAssistantTranscriptMessage(finalApiContent, result.reasoningContent));
      onApiTranscript?.(responseTranscript);
      onChunk(finalContent);
      return finalContent;
    }

    const assistantToolMessage = buildAssistantToolMessage(result);
    const toolMessages = await runToolCallsInParallel(result.toolCalls, { client, onStatus: emitStatus });
    messages = [
      ...messages,
      assistantToolMessage,
      ...toolMessages,
    ];
    responseTranscript.push(assistantToolMessage, ...toolMessages);
  }

  const fallbackAnswerContent = withSourceLinks(latestContent, sourceUrls);
  responseTranscript.push(buildFinalAssistantTranscriptMessage(fallbackAnswerContent, latestReasoningContent));
  onApiTranscript?.(responseTranscript);
  const fallbackContent = withStatusPrefix(statusHistory, fallbackAnswerContent);
  onChunk(fallbackContent);
  return fallbackContent;
}
