export const CHAT_CONTENT_MAX_WIDTH = 850;
export const CHAT_CONTENT_MIN_WIDTH = 240;
export const CHAT_CONTENT_PADDING_X = 32;
const CHAT_CONTENT_WIDTH_BUCKET = 8;

export function getChatContentWidth(containerWidth: number): number {
  const safeContainerWidth = Math.max(1, Math.floor(containerWidth));
  return Math.max(
    CHAT_CONTENT_MIN_WIDTH,
    Math.min(CHAT_CONTENT_MAX_WIDTH, safeContainerWidth - CHAT_CONTENT_PADDING_X),
  );
}

export function normalizeChatContentWidth(containerWidth: number): number {
  const contentWidth = getChatContentWidth(containerWidth);
  if (contentWidth >= CHAT_CONTENT_MAX_WIDTH) {
    return CHAT_CONTENT_MAX_WIDTH;
  }

  return Math.max(
    CHAT_CONTENT_MIN_WIDTH,
    Math.floor(contentWidth / CHAT_CONTENT_WIDTH_BUCKET) * CHAT_CONTENT_WIDTH_BUCKET,
  );
}

export function normalizeChatContainerWidth(containerWidth: number): number {
  return normalizeChatContentWidth(containerWidth) + CHAT_CONTENT_PADDING_X;
}
