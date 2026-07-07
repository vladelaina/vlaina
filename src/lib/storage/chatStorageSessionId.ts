import { isSafeChatSessionId } from './unifiedStorageAI';

export function assertSafeChatSessionId(sessionId: string): void {
  if (!isSafeChatSessionId(sessionId)) {
    throw new Error(`Unsafe chat session id: ${sessionId}`);
  }
}
