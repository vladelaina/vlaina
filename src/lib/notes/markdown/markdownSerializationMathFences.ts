import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';
import {
  ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN,
  ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN,
  ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN, ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN,
  ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN,
  LATEX_LIKE_MATH_CONTENT_PATTERN,
  STANDALONE_BRACKET_MATH_PATTERN,
  STANDALONE_DOLLAR_MATH_PATTERN,
} from './markdownSerializationShared';

export function normalizeAlternativeMathBlockFences(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output: string[] = [];
    let pendingFence: {
      prefix: string;
      bracketCloseFence: boolean;
      bracketOnlyFence: boolean;
      lines: string[];
    } | null = null;

    for (const line of lines) {
      if (pendingFence) {
        const close = getAlternativeMathBlockClose(line, pendingFence);

        if (
          close
          && (!pendingFence.bracketOnlyFence
            || isLatexLikeMathBlock([
              ...pendingFence.lines.slice(1),
              ...(close.contentLine === null ? [] : [close.contentLine]),
            ]))
        ) {
          const converted = [
            `${pendingFence.prefix}$$`,
            ...pendingFence.lines.slice(1),
            ...(close.contentLine === null ? [] : [close.contentLine]),
            `${pendingFence.prefix}$$`,
          ];
          if (close.bracketClose && converted.length > 2) {
            const contentLineIndex = converted.length - 2;
            converted[contentLineIndex] = stripSingleTrailingBackslash(
              converted[contentLineIndex] ?? ''
            );
          }
          output.push(...converted);
          pendingFence = null;
          continue;
        }

        pendingFence.lines.push(line);
        continue;
      }

      const standaloneDollar = STANDALONE_DOLLAR_MATH_PATTERN.exec(line);
      if (standaloneDollar) {
        const prefix = standaloneDollar[1] ?? '';
        output.push(`${prefix}$$`, `${prefix}${standaloneDollar[2] ?? ''}`, `${prefix}$$`);
        continue;
      }

      const standaloneBracket = STANDALONE_BRACKET_MATH_PATTERN.exec(line);
      if (standaloneBracket) {
        const prefix = standaloneBracket[1] ?? '';
        output.push(`${prefix}$$`, `${prefix}${standaloneBracket[2] ?? ''}`, `${prefix}$$`);
        continue;
      }

      const open = ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN.exec(line);
      if (open) {
        pendingFence = {
          prefix: open[1] ?? '',
          bracketCloseFence: isAlternativeMathBlockBracketCloseFence(open[2] ?? ''),
          bracketOnlyFence: line.trim() === '[',
          lines: [line],
        };
        continue;
      }

      output.push(line);
    }

    if (pendingFence) {
      output.push(...pendingFence.lines);
    }

    return output.join('\n');
  }, { protectMathBlocks: false });
}

export function getAlternativeMathBlockClose(
  line: string,
  pendingFence: { prefix: string; bracketCloseFence: boolean; bracketOnlyFence: boolean }
): { bracketClose: boolean; contentLine: string | null } | null {
  const standardClose = ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN.exec(line);
  if (standardClose && (standardClose[1] ?? '') === pendingFence.prefix) {
    return { bracketClose: false, contentLine: null };
  }

  const canUseBracketClose = pendingFence.bracketCloseFence || pendingFence.bracketOnlyFence;
  const bracketClose = canUseBracketClose
    ? ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_PATTERN.exec(line)
    : null;
  if (bracketClose && (bracketClose[1] ?? '') === pendingFence.prefix) {
    return { bracketClose: true, contentLine: null };
  }

  const standardSuffix = ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_SUFFIX_PATTERN.exec(line);
  if (standardSuffix && hasAlternativeMathInlineCloseContent(standardSuffix[1] ?? '', pendingFence.prefix)) {
    return { bracketClose: false, contentLine: standardSuffix[1] ?? '' };
  }

  const bracketSuffix = canUseBracketClose
    ? ALTERNATIVE_MATH_BLOCK_BRACKET_CLOSE_SUFFIX_PATTERN.exec(line)
    : null;
  if (bracketSuffix && hasAlternativeMathInlineCloseContent(bracketSuffix[1] ?? '', pendingFence.prefix)) {
    return { bracketClose: true, contentLine: bracketSuffix[1] ?? '' };
  }

  return null;
}

export function hasAlternativeMathInlineCloseContent(contentLine: string, prefix: string): boolean {
  if (prefix && !contentLine.startsWith(prefix)) return false;
  return contentLine.slice(prefix.length).trim().length > 0;
}

export function isLatexLikeMathBlock(lines: readonly string[]): boolean {
  return LATEX_LIKE_MATH_CONTENT_PATTERN.test(lines.join('\n'));
}

export function isAlternativeMathBlockBracketCloseFence(marker: string): boolean {
  return marker === '[' || marker.endsWith('\\');
}

export function stripSingleTrailingBackslash(line: string): string {
  const withoutTrailingWhitespace = line.replace(/[ \t]+$/, '');
  return withoutTrailingWhitespace.endsWith('\\') && !withoutTrailingWhitespace.endsWith('\\\\')
    ? withoutTrailingWhitespace.slice(0, -1)
    : line;
}
