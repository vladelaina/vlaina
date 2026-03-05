function normalizeImageMarkdownTarget(rawTarget: string): string | null {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    const wrapped = trimmed.slice(1, -1).trim();
    return wrapped || null;
  }

  const firstSegment = trimmed.split(/\s+/)[0]?.trim();
  return firstSegment || null;
}

interface MarkdownImageToken {
  start: number;
  end: number;
  src: string | null;
}

function parseMarkdownImageTarget(content: string, targetStart: number): { raw: string; end: number } | null {
  let pos = targetStart;
  const length = content.length;

  while (pos < length && /\s/.test(content[pos])) {
    pos += 1;
  }
  if (pos >= length) {
    return null;
  }

  if (content[pos] === "<") {
    const rawStart = pos + 1;
    const closingAngle = content.indexOf(">", rawStart);
    if (closingAngle === -1) {
      return null;
    }

    let cursor = closingAngle + 1;
    while (cursor < length && /\s/.test(content[cursor])) {
      cursor += 1;
    }
    if (cursor >= length || content[cursor] !== ")") {
      return null;
    }
    return {
      raw: content.slice(rawStart, closingAngle),
      end: cursor + 1,
    };
  }

  const rawStart = pos;
  let depth = 0;
  while (pos < length) {
    const ch = content[pos];
    if (ch === "(") {
      depth += 1;
      pos += 1;
      continue;
    }
    if (ch === ")") {
      if (depth === 0) {
        const raw = content.slice(rawStart, pos).trimEnd();
        return {
          raw,
          end: pos + 1,
        };
      }
      depth -= 1;
      pos += 1;
      continue;
    }
    pos += 1;
  }

  return null;
}

function parseMarkdownImageTokens(content: string): MarkdownImageToken[] {
  const tokens: MarkdownImageToken[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const imageStart = content.indexOf("![", cursor);
    if (imageStart === -1) {
      break;
    }

    const bracketAndParen = content.indexOf("](", imageStart + 2);
    if (bracketAndParen === -1) {
      cursor = imageStart + 2;
      continue;
    }

    const parsed = parseMarkdownImageTarget(content, bracketAndParen + 2);
    if (!parsed) {
      cursor = bracketAndParen + 2;
      continue;
    }

    tokens.push({
      start: imageStart,
      end: parsed.end,
      src: normalizeImageMarkdownTarget(parsed.raw),
    });
    cursor = parsed.end;
  }

  return tokens;
}

export function extractMarkdownImageSources(content: string): string[] {
  return parseMarkdownImageTokens(content)
    .map((token) => token.src)
    .filter((src): src is string => !!src);
}

export function stripMarkdownImageTokens(content: string): string {
  const tokens = parseMarkdownImageTokens(content);
  if (tokens.length === 0) {
    return content;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const token of tokens) {
    parts.push(content.slice(cursor, token.start));
    cursor = token.end;
  }
  parts.push(content.slice(cursor));
  return parts.join("");
}

export function formatMessageCopyText(content: string): string {
  const tokens = parseMarkdownImageTokens(content);
  if (tokens.length === 0) {
    return content;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const token of tokens) {
    parts.push(content.slice(cursor, token.start));
    if (token.src) {
      parts.push(token.src.startsWith("data:image/") ? "[image]" : token.src);
    }
    cursor = token.end;
  }
  parts.push(content.slice(cursor));
  return parts.join("");
}

export async function copyImageSourceToClipboard(src: string): Promise<boolean> {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (ClipboardItemCtor && blob.type.startsWith("image/")) {
      const item = new ClipboardItemCtor({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
  }
  return false;
}

export async function copyMessageContentToClipboard(content: string): Promise<void> {
  const imageSources = extractMarkdownImageSources(content);
  if (imageSources.length > 0) {
    const copied = await copyImageSourceToClipboard(imageSources[0]);
    if (copied) {
      return;
    }
  }

  await navigator.clipboard.writeText(formatMessageCopyText(content));
}
