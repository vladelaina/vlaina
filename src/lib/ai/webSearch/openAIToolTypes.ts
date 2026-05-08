import type { ChatMessageContent } from '@/lib/ai/types';

export interface OpenAIWireMessage {
  role: string;
  content: ChatMessageContent | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIStreamToolResult {
  content: string;
  toolCalls: OpenAIToolCall[];
}
