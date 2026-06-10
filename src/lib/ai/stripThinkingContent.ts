const THINKING_OPEN_TAG_REGEX = /<think>/gi;
const THINKING_CLOSE_TAG_REGEX = /<\/think>/gi;
const THINK_CLOSE_TAG = '</think>';
export const MAX_THINKING_TAG_MATCHES = 200;
export const MAX_EXTRACTED_THINKING_CONTENT_CHARS = 256 * 1024;

export type ParsedThinkingContent = {
  hasThinking: boolean;
  isComplete: boolean;
  parts: string[];
  visible: string;
};

function stripTrailingTagPrefix(content: string, tag: string): string {
  for (let length = tag.length - 1; length > 0; length -= 1) {
    if (endsWithAsciiCaseInsensitivePrefix(content, tag, length)) {
      return content.slice(0, -length);
    }
  }

  return content;
}

function endsWithAsciiCaseInsensitivePrefix(content: string, tag: string, length: number): boolean {
  if (content.length < length) return false;
  const start = content.length - length;

  for (let index = 0; index < length; index += 1) {
    if (content[start + index]?.toLowerCase() !== tag[index]?.toLowerCase()) {
      return false;
    }
  }

  return true;
}

export function parseThinkingContent(content: string): ParsedThinkingContent {
  const parts: string[] = [];
  let hasThinking = false;
  let visible = '';
  let cursor = 0;
  let matches = 0;
  let totalChars = 0;
  THINKING_OPEN_TAG_REGEX.lastIndex = 0;
  THINKING_CLOSE_TAG_REGEX.lastIndex = 0;

  for (;;) {
    if (matches >= MAX_THINKING_TAG_MATCHES) {
      return {
        hasThinking,
        isComplete: true,
        parts,
        visible,
      };
    }

    THINKING_OPEN_TAG_REGEX.lastIndex = cursor;
    const open = THINKING_OPEN_TAG_REGEX.exec(content);
    if (!open) {
      return {
        hasThinking,
        isComplete: true,
        parts,
        visible: `${visible}${content.slice(cursor)}`,
      };
    }

    visible += content.slice(cursor, open.index);
    hasThinking = true;
    matches += 1;

    const bodyStart = THINKING_OPEN_TAG_REGEX.lastIndex;
    THINKING_CLOSE_TAG_REGEX.lastIndex = bodyStart;
    const close = THINKING_CLOSE_TAG_REGEX.exec(content);
    const isClosed = close !== null;
    const bodyEnd = isClosed ? close.index : content.length;
    const availableChars = MAX_EXTRACTED_THINKING_CONTENT_CHARS - totalChars;
    if (availableChars > 0) {
      const rawPart = content.slice(bodyStart, Math.min(bodyEnd, bodyStart + availableChars));
      const part = isClosed ? rawPart : stripTrailingTagPrefix(rawPart, THINK_CLOSE_TAG);
      if (part) {
        parts.push(part);
        totalChars += part.length;
      }
    }

    if (!isClosed) {
      return {
        hasThinking: true,
        isComplete: false,
        parts,
        visible,
      };
    }

    cursor = close.index + THINK_CLOSE_TAG.length;
  }
}

export function extractThinkingContentParts(content: string): string[] {
  return parseThinkingContent(content).parts;
}

export function stripThinkingContent(content: string): string {
  return parseThinkingContent(content).visible.trim();
}
