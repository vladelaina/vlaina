import { parseMarkdownAndHtmlImageTokens } from '@/components/Chat/common/messageImageTokens';
import { normalizeRenderableDataImageSrc } from '@/components/common/markdown/imagePolicy';

const INLINE_IMAGE_TOKEN_PREFIX = 'asset://localhost/chat-inline-image/';
const LARGE_DATA_IMAGE_MIN_LENGTH = 50_000;
const DATA_IMAGE_TARGET_HINT_PATTERN = /\bdata(?::|&|&#)/i;

export interface CompactedChatMarkdownImages {
  markdown: string;
  imageSrcByToken: Map<string, string>;
  replaced: number;
}

function normalizeCompactableImageSrc(src: string): string | null {
  if (src.length < LARGE_DATA_IMAGE_MIN_LENGTH) {
    return null;
  }
  return normalizeRenderableDataImageSrc(src);
}

function createToken(index: number): string {
  return `${INLINE_IMAGE_TOKEN_PREFIX}${index}`;
}

function getExistingInlineImageTokens(markdown: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of markdown.matchAll(/asset:\/\/localhost\/chat-inline-image\/\d+/g)) {
    tokens.add(match[0]);
  }
  return tokens;
}

function createAvailableToken(index: number, unavailableTokens: Set<string>): { token: string; nextIndex: number } {
  let nextIndex = index;
  let token = createToken(nextIndex);
  while (unavailableTokens.has(token)) {
    nextIndex += 1;
    token = createToken(nextIndex);
  }
  unavailableTokens.add(token);
  return { token, nextIndex: nextIndex + 1 };
}

export function resolveCompactedChatImageSrc(
  src: string,
  imageSrcByToken: Map<string, string> | undefined,
): string {
  if (!src.startsWith(INLINE_IMAGE_TOKEN_PREFIX)) {
    return src;
  }
  return imageSrcByToken?.get(src) ?? src;
}

export function compactLargeDataImageMarkdown(markdown: string): CompactedChatMarkdownImages {
  if (!DATA_IMAGE_TARGET_HINT_PATTERN.test(markdown)) {
    return {
      markdown,
      imageSrcByToken: new Map(),
      replaced: 0,
    };
  }

  const imageSrcByToken = new Map<string, string>();
  const unavailableTokens = getExistingInlineImageTokens(markdown);
  let tokenIndex = 0;
  let replaced = 0;
  const tokens = parseMarkdownAndHtmlImageTokens(markdown);
  const parts: string[] = [];
  let cursor = 0;

  for (const imageToken of tokens) {
    if (imageToken.start < cursor) {
      continue;
    }
    const src = imageToken.src ? normalizeCompactableImageSrc(imageToken.src) : null;
    if (!src) {
      continue;
    }
    if (typeof imageToken.targetStart !== 'number' || typeof imageToken.targetEnd !== 'number') {
      continue;
    }

    const tokenResult = createAvailableToken(tokenIndex, unavailableTokens);
    const token = tokenResult.token;
    tokenIndex = tokenResult.nextIndex;
    parts.push(markdown.slice(cursor, imageToken.start));
    parts.push(markdown.slice(imageToken.start, imageToken.targetStart));
    parts.push(token);
    parts.push(markdown.slice(imageToken.targetEnd, imageToken.end));
    cursor = imageToken.end;
    replaced += 1;
    imageSrcByToken.set(token, src);
  }

  parts.push(markdown.slice(cursor));

  return {
    markdown: replaced > 0 ? parts.join('') : markdown,
    imageSrcByToken,
    replaced,
  };
}
