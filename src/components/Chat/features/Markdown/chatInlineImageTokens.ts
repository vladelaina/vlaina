import { parseMarkdownImageTokens } from '@/components/Chat/common/messageImageTokens';

const INLINE_IMAGE_TOKEN_PREFIX = 'asset://localhost/chat-inline-image/';
const LARGE_DATA_IMAGE_MIN_LENGTH = 50_000;

export interface CompactedChatMarkdownImages {
  markdown: string;
  imageSrcByToken: Map<string, string>;
  replaced: number;
}

function shouldCompactImageSrc(src: string): boolean {
  return src.length >= LARGE_DATA_IMAGE_MIN_LENGTH && src.startsWith('data:image/');
}

function createToken(index: number): string {
  return `${INLINE_IMAGE_TOKEN_PREFIX}${index}`;
}

function replaceMarkdownImageTarget(markdownToken: string, src: string, token: string): string | null {
  const targetMarkerIndex = markdownToken.indexOf('](');
  const searchStart = targetMarkerIndex === -1 ? 0 : targetMarkerIndex + 2;
  const srcStart = markdownToken.indexOf(src, searchStart);
  if (srcStart === -1) {
    return null;
  }

  return `${markdownToken.slice(0, srcStart)}${token}${markdownToken.slice(srcStart + src.length)}`;
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
  if (!markdown.includes('data:image/')) {
    return {
      markdown,
      imageSrcByToken: new Map(),
      replaced: 0,
    };
  }

  const imageSrcByToken = new Map<string, string>();
  let replaced = 0;
  const tokens = parseMarkdownImageTokens(markdown);
  const parts: string[] = [];
  let cursor = 0;

  for (const imageToken of tokens) {
    const src = imageToken.src;
    if (!src || !shouldCompactImageSrc(src)) {
      continue;
    }

    const original = markdown.slice(imageToken.start, imageToken.end);
    const token = createToken(replaced);
    const compactedToken = replaceMarkdownImageTarget(original, src, token);
    if (!compactedToken) {
      continue;
    }

    parts.push(markdown.slice(cursor, imageToken.start));
    parts.push(compactedToken);
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
