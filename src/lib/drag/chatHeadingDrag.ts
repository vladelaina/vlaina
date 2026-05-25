export const VLAINA_CHAT_HEADING_DRAG_MIME = 'application/x-vlaina-chat-heading+json';

export interface ChatHeadingDragPayload {
  level: number;
  text: string;
}

export function serializeChatHeadingDragPayload(payload: ChatHeadingDragPayload): string {
  return JSON.stringify(payload);
}

export function parseChatHeadingDragPayload(raw: string): ChatHeadingDragPayload | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ChatHeadingDragPayload>;
    const level = typeof parsed.level === 'number' ? parsed.level : null;
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (level === null || !Number.isInteger(level) || level < 1 || level > 6 || !text) return null;
    return { level, text };
  } catch {
    return null;
  }
}
