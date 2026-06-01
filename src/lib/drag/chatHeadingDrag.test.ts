import { describe, expect, it } from 'vitest';
import {
  parseChatHeadingDragPayload,
  serializeChatHeadingDragPayload,
  CHAT_HEADING_DRAG_MIME,
} from './chatHeadingDrag';

describe('chatHeadingDrag', () => {
  it('uses a stable custom MIME type', () => {
    expect(CHAT_HEADING_DRAG_MIME).toBe('application/x-vlaina-chat-heading+json');
  });

  it('round-trips heading drag payloads', () => {
    const serialized = serializeChatHeadingDragPayload({ level: 2, text: 'Title' });

    expect(parseChatHeadingDragPayload(serialized)).toEqual({ level: 2, text: 'Title' });
  });

  it('trims text and rejects invalid payloads', () => {
    expect(parseChatHeadingDragPayload('{"level":1,"text":"  Title  "}')).toEqual({
      level: 1,
      text: 'Title',
    });
    expect(parseChatHeadingDragPayload('')).toBeNull();
    expect(parseChatHeadingDragPayload('not-json')).toBeNull();
    expect(parseChatHeadingDragPayload('{"level":0,"text":"Title"}')).toBeNull();
    expect(parseChatHeadingDragPayload('{"level":7,"text":"Title"}')).toBeNull();
    expect(parseChatHeadingDragPayload('{"level":1,"text":"   "}')).toBeNull();
  });
});
