import type { ChatCompletionRequest } from '@/lib/ai/types';
import type { WebSearchToolRunnerOptions } from './toolRunner';
import type { OpenAIWireMessage } from './openAIToolTypes';

export const MAX_WEB_SEARCH_TOOL_LOOPS = 6;
export const MAX_NO_RESULT_SEARCH_ATTEMPTS = 3;
export const MAX_TEXT_PROTOCOL_SEARCH_REQUEST_JSON_CHARS = 64 * 1024;
export const MAX_TEXT_PROTOCOL_SEARCH_QUERY_CHARS = 1000;
export const MAX_TEXT_PROTOCOL_SEARCH_REASON_CHARS = 500;
export const MAX_LOOP_READ_CACHE_URLS = 8;
export const MAX_LOOP_TOOL_NAME_CHARS = 128;
export const MAX_LOOP_READ_CACHE_CONTENT_CHARS = 32 * 1024;
export const MAX_PARALLEL_WEB_SEARCH_TOOL_CALLS = 3;
export const MAX_WEB_SEARCH_TOOL_CALL_CONCURRENCY = MAX_PARALLEL_WEB_SEARCH_TOOL_CALLS;
export const MAX_WEB_SEARCH_QUERY_ARG_CHARS = 1000;
export const MAX_WEB_SEARCH_URL_ARG_CHARS = 16 * 1024;
export const MAX_WEB_SEARCH_OPTION_ARG_CHARS = 64;
export const MAX_WEB_SEARCH_BATCH_URLS = 8;
export const TEXT_PROTOCOL_SEARCH_REQUEST_TAG_REGEX = /<web_search_request\b/i;

export interface ToolLoopOptions extends WebSearchToolRunnerOptions {
  body: ChatCompletionRequest;
  onChunk: (chunk: string) => void;
  onApiTranscript?: (messages: OpenAIWireMessage[]) => void;
  request: (body: ChatCompletionRequest) => Promise<Response>;
}

export interface JsonToolLoopOptions extends WebSearchToolRunnerOptions {
  body: ChatCompletionRequest;
  onChunk: (chunk: string) => void;
  onApiTranscript?: (messages: OpenAIWireMessage[]) => void;
  requestJson: (body: ChatCompletionRequest) => Promise<Record<string, unknown>>;
}

export interface PrefetchOptions extends WebSearchToolRunnerOptions {
  body: ChatCompletionRequest;
  onChunk: (chunk: string) => void;
  onApiTranscript?: (messages: OpenAIWireMessage[]) => void;
}

export interface StreamingTextProtocolOptions extends PrefetchOptions {
  request: (body: ChatCompletionRequest) => Promise<Response>;
}

export interface JsonTextProtocolOptions extends PrefetchOptions {
  requestJson: (body: ChatCompletionRequest) => Promise<Record<string, unknown>>;
}

export interface TextRequestProtocolOptions extends PrefetchOptions {
  requestText: (body: ChatCompletionRequest, onChunk: (content: string) => void) => Promise<string>;
}
