export const CHAT_MESSAGE_COPIED_EVENT = 'neko-chat-message-copied';

interface ChatMessageCopiedDetail {
  messageId: string;
}

export function dispatchChatMessageCopied(messageId: string) {
  window.dispatchEvent(
    new CustomEvent<ChatMessageCopiedDetail>(CHAT_MESSAGE_COPIED_EVENT, {
      detail: { messageId },
    })
  );
}
