import { WEB_SEARCH_SYSTEM_INSTRUCTION } from './toolDefinitions';
import type { OpenAIWireMessage } from './openAIToolTypes';

export function appendWebSearchSystemInstruction(messages: OpenAIWireMessage[]): OpenAIWireMessage[] {
  const [first, ...rest] = messages;
  if (first?.role === 'system' && typeof first.content === 'string') {
    return [{ ...first, content: `${first.content}\n\n${WEB_SEARCH_SYSTEM_INSTRUCTION}` }, ...rest];
  }
  return [{ role: 'system', content: WEB_SEARCH_SYSTEM_INSTRUCTION }, ...messages];
}
