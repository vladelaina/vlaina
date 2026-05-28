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
  const compacted = markdown.replace(
    /!\[([^\]]*)]\((<)?(data:image\/[^)\s>]+)(>)?\)/g,
    (full, alt: string, open: string | undefined, src: string, close: string | undefined) => {
      if (!shouldCompactImageSrc(src)) {
        return full;
      }

      const token = createToken(replaced);
      replaced += 1;
      imageSrcByToken.set(token, src);
      return `![${alt}](${open ? '<' : ''}${token}${close ? '>' : ''})`;
    },
  );

  return {
    markdown: compacted,
    imageSrcByToken,
    replaced,
  };
}
