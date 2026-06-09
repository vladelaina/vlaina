import { getParentPath, joinPath, toFileUrl } from '@/lib/storage/adapter';
import { findCssUrlTokens } from './tokenizer';
import type { RelativeMarkdownThemeCssUrl } from './types';
import { isRelativeCssAssetUrl, renderCssUrl, splitCssUrlSuffix } from './urlIdentity';

export const MAX_MARKDOWN_THEME_CSS_URL_REWRITE_CONCURRENCY = 8;

export async function rebaseRelativeMarkdownThemeCssUrls(
  css: string,
  sourcePath?: string | null
): Promise<string> {
  return rewriteRelativeMarkdownThemeCssUrls(css, sourcePath, async ({ path, suffix }) => {
    const sourceDir = sourcePath ? getParentPath(sourcePath) : null;
    if (!sourceDir) return null;

    const assetPath = await joinPath(sourceDir, path);
    return `${await toFileUrl(assetPath)}${suffix}`;
  });
}

export async function rewriteRelativeMarkdownThemeCssUrls(
  css: string,
  sourcePath: string | null | undefined,
  resolveAssetUrl: (asset: RelativeMarkdownThemeCssUrl) => Promise<string | null>
): Promise<string> {
  const sourceDir = sourcePath ? getParentPath(sourcePath) : null;
  if (!sourceDir) {
    return css;
  }

  const tokens = findCssUrlTokens(css);
  if (tokens.length === 0) {
    return css;
  }

  const replacements = await mapWithConcurrencyLimit(
    tokens,
    MAX_MARKDOWN_THEME_CSS_URL_REWRITE_CONCURRENCY,
    async (token) => {
      if (!isRelativeCssAssetUrl(token.url)) {
        return token.raw;
      }

      const { path, suffix } = splitCssUrlSuffix(token.url);
      try {
        const resolvedUrl = await resolveAssetUrl({ url: token.url, path, suffix });
        return resolvedUrl ? renderCssUrl(resolvedUrl) : token.raw;
      } catch {
        return token.raw;
      }
    }
  );

  let output = '';
  let cursor = 0;
  tokens.forEach((token, tokenIndex) => {
    output += css.slice(cursor, token.start);
    output += replacements[tokenIndex] ?? token.raw;
    cursor = token.end;
  });
  return output + css.slice(cursor);
}

async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index]!);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
