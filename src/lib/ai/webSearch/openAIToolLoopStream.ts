import type { ChatCompletionRequest } from '@/lib/ai/types';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { addChatDebugLog } from '@/lib/debug/chatDebugLog';
import { classifyWebSearchIntent } from './intent';
import { buildWebSearchTools } from './toolDefinitions';
import { sanitizeWebSearchStatus } from './statusMarkup';
import { appendWebSearchSystemInstruction } from './openAIToolParsing';
import { consumeOpenAIStreamWithTools } from './openAIStreamWithTools';
import type { ToolLoopOptions } from './openAIToolLoopTypes';
import type { WebSearchStatus } from './types';
import type { OpenAIWireMessage } from './openAIToolTypes';
import {
  appendSuccessfulReadSources, buildFinalAssistantTranscriptMessage, buildVisibleAnswerReminderMessage,
  countNoResultSearchAttempts, emitApiTranscript, emitChunk, emitWebSearchStatus, finishNoResultSearchLocally,
  finishWebSearchCapabilityLocally, getLatestUserText, hasAnySearchResults, hasSuccessfulRead,
  hasVisibleAnswerContent, resolveFinalAssistantApiContent, shouldRequirePageRead, shouldStopNoResultSearchLoop,
  throwIfAborted, throwIfMissingVisibleAnswer, withSourceLinks, withStatusPrefix, withoutTools,
} from './openAIToolLoopShared';
import { buildTextProtocolSearchMessages } from './openAIToolLoopTextProtocolSearch';
import {
  boundedToolNameForLog, buildCachedReadToolMessages, cacheReadContentForToolMessages, getReadToolUrls,
  hasOnlyAlreadyReadToolCalls, hasOnlySearchToolCalls,
} from './openAIToolLoopToolArgs';
import { appendForcedReadMessages, buildAssistantToolMessage, runToolCallsInParallel } from './openAIToolLoopToolRuntime';
import { recoverStreamingVisibleAnswer } from './openAIToolLoopRecovery';
import { MAX_WEB_SEARCH_TOOL_LOOPS } from './openAIToolLoopTypes';

export async function runOpenAIWebSearchToolLoop({
  body,
  onChunk,
  request,
  client,
  onStatus,
  onApiTranscript,
  signal,
}: ToolLoopOptions): Promise<string> {
  throwIfAborted(signal);
  const localIntent = classifyWebSearchIntent(getLatestUserText(body));
  if (localIntent.action === 'answer-capability') {
    return finishWebSearchCapabilityLocally({ body, onChunk, onApiTranscript, signal });
  }
  if (localIntent.action === 'prefetch') {
    addChatDebugLog('web-search-loop', 'stream local intent requested search', {
      query: localIntent.query,
      reason: localIntent.reason,
    });
    const {
      messages: prefetchMessages,
      statusHistory: prefetchStatusHistory,
      sourceUrls: prefetchSourceUrls,
    } = await buildTextProtocolSearchMessages({
      body,
      query: localIntent.query,
      client,
      onStatus,
      signal,
    });
    let latestPrefetchContent = '';
    const emitPrefetchContent = (content: string) => {
      latestPrefetchContent = content;
      emitChunk(onChunk, signal, withStatusPrefix(prefetchStatusHistory, latestPrefetchContent));
    };
    emitChunk(onChunk, signal, withStatusPrefix(prefetchStatusHistory, latestPrefetchContent));
    const answerResponse = await request({
      ...withoutTools(body),
      messages: prefetchMessages as ChatCompletionRequest['messages'],
    });
    const answer = await consumeOpenAIStreamWithTools(answerResponse, emitPrefetchContent, { signal });
    throwIfAborted(signal);
    const finalApiContent = withSourceLinks(answer.assistantContent || answer.content, prefetchSourceUrls);
    throwIfMissingVisibleAnswer(finalApiContent);
    const finalContent = withStatusPrefix(prefetchStatusHistory, finalApiContent);
    emitChunk(onChunk, signal, finalContent);
    emitApiTranscript(onApiTranscript, signal, [
      buildFinalAssistantTranscriptMessage(finalApiContent, answer.reasoningContent),
    ]);
    return finalContent;
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
      toolCalls: result.toolCalls.map((call) => boundedToolNameForLog(call.function.name)),
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
        skippedToolCalls: result.toolCalls.map((call) => boundedToolNameForLog(call.function.name)),
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
        name: boundedToolNameForLog(call.function.name),
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
