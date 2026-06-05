export const CHAT_HEADING_DRAG_MIME = 'application/x-vlaina-chat-heading+json';

const MAX_HEADING_DRAG_PAYLOAD_CHARS = 16 * 1024;
const MAX_HEADING_DRAG_TEXT_CHARS = 2_000;

export interface ChatHeadingDragPayload {
  level: number;
  text: string;
}

export function serializeChatHeadingDragPayload(payload: ChatHeadingDragPayload): string {
  return JSON.stringify(payload);
}

export function parseChatHeadingDragPayload(raw: string): ChatHeadingDragPayload | null {
  if (!raw) return null;
  if (raw.length > MAX_HEADING_DRAG_PAYLOAD_CHARS) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ChatHeadingDragPayload>;
    const level = typeof parsed.level === 'number' ? parsed.level : null;
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (level === null || !Number.isInteger(level) || level < 1 || level > 6 || !text) return null;
    if (text.length > MAX_HEADING_DRAG_TEXT_CHARS) return null;
    return { level, text };
  } catch {
    return null;
  }
}
