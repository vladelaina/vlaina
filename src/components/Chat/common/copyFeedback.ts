type ChatMessageCopiedListener = (messageId: string) => void;

const copiedListeners = new Set<ChatMessageCopiedListener>();

export function dispatchChatMessageCopied(messageId: string) {
  copiedListeners.forEach((listener) => {
    listener(messageId);
  });
}

export function subscribeChatMessageCopied(listener: ChatMessageCopiedListener) {
  copiedListeners.add(listener);
  return () => {
    copiedListeners.delete(listener);
  };
}
