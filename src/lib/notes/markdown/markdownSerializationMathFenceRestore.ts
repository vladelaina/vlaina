import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';
import {
  getAlternativeMathBlockClose,
  isAlternativeMathBlockBracketCloseFence,
  isLatexLikeMathBlock,
  stripSingleTrailingBackslash,
} from './markdownSerializationMathFences';
import {
  ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN,
  DOLLAR_MATH_BLOCK_FENCE_PATTERN,
  DollarMathFenceMatch,
  MathBlockFenceReference, MathBlockFenceReferenceIndex,
  MathBlockFenceStyle,
  STANDALONE_BRACKET_MATH_PATTERN,
  STANDALONE_DOLLAR_MATH_PATTERN,
} from './markdownSerializationShared';

export function restoreMathBlockFenceStylesFromReference(markdown: string, reference: string): string {
  const references = collectMathBlockFenceReferences(reference);
  if (!references.some((item) => item.style !== 'dollar')) {
    return markdown;
  }

  const referenceIndex = createMathBlockFenceReferenceIndex(references);
  let nextReferenceIndex = 0;
  return mapMarkdownOutsideProtectedSegments(markdown, (segment) => {
    const lines = segment.split('\n');
    const dollarFenceMatches = collectDollarMathFenceMatches(lines);
    const output: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const match = dollarFenceMatches.get(index);
      if (!match) {
        output.push(lines[index]);
        continue;
      }

      const referenceMatch = takeMatchingMathBlockFenceReference(
        references,
        referenceIndex,
        normalizeMathBlockLatex(joinLineRange(lines, index + 1, match.closeIndex)),
        nextReferenceIndex
      );
      nextReferenceIndex = referenceMatch.nextIndex;

      const singleLineLatex = match.closeIndex === index + 2
        ? stripMathContainerPrefix(lines[index + 1] ?? '', match.prefix)
        : null;
      if (referenceMatch.style === 'dollar-inline' && singleLineLatex !== null) {
        output.push(`${match.prefix}$$${singleLineLatex}$$`);
      } else if (referenceMatch.style === 'bracket-inline' && singleLineLatex !== null) {
        output.push(`${match.prefix}\\[${singleLineLatex}\\]`);
      } else if (referenceMatch.style === 'bracket') {
        output.push(`${match.prefix}\\[`);
        for (let cursor = index + 1; cursor < match.closeIndex; cursor += 1) {
          output.push(lines[cursor] ?? '');
        }
        output.push(`${match.prefix}\\]`);
      } else {
        for (let cursor = index; cursor <= match.closeIndex; cursor += 1) {
          output.push(lines[cursor] ?? '');
        }
      }
      index = match.closeIndex;
    }

    return output.join('\n');
  }, { protectMathBlocks: false });
}

export function takeMatchingMathBlockFenceReference(
  references: readonly MathBlockFenceReference[],
  referenceIndex: MathBlockFenceReferenceIndex,
  latex: string,
  startIndex: number
): { style: MathBlockFenceStyle | null; nextIndex: number } {
  const direct = references[startIndex];
  if (direct && referenceIndex.normalizedLatexes[startIndex] === latex) {
    return { style: direct.style, nextIndex: startIndex + 1 };
  }

  const matchIndex = findNextMathBlockFenceReferenceIndex(
    referenceIndex.byLatex.get(latex) ?? [],
    startIndex
  );
  if (matchIndex !== null) {
    return { style: references[matchIndex]?.style ?? null, nextIndex: matchIndex + 1 };
  }

  return { style: null, nextIndex: startIndex };
}

export function createMathBlockFenceReferenceIndex(
  references: readonly MathBlockFenceReference[]
): MathBlockFenceReferenceIndex {
  const byLatex = new Map<string, number[]>();
  const normalizedLatexes: string[] = [];

  references.forEach((reference, index) => {
    const latex = normalizeMathBlockLatex(reference.latex);
    normalizedLatexes.push(latex);
    const indexes = byLatex.get(latex);
    if (indexes) {
      indexes.push(index);
    } else {
      byLatex.set(latex, [index]);
    }
  });

  return { byLatex, normalizedLatexes };
}

export function findNextMathBlockFenceReferenceIndex(
  indexes: readonly number[],
  startIndex: number
): number | null {
  let low = 0;
  let high = indexes.length - 1;
  let result: number | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const index = indexes[mid] ?? 0;
    if (index <= startIndex) {
      low = mid + 1;
    } else {
      result = index;
      high = mid - 1;
    }
  }

  return result;
}

export function collectDollarMathFenceMatches(lines: readonly string[]): Map<number, DollarMathFenceMatch> {
  const matches = new Map<number, DollarMathFenceMatch>();
  const openByPrefix = new Map<string, number>();

  for (let index = 0; index < lines.length; index += 1) {
    const fence = DOLLAR_MATH_BLOCK_FENCE_PATTERN.exec(lines[index]);
    if (!fence) continue;

    const prefix = fence[1] ?? '';
    const openIndex = openByPrefix.get(prefix);
    if (openIndex === undefined) {
      openByPrefix.set(prefix, index);
      continue;
    }

    matches.set(openIndex, {
      prefix,
      closeIndex: index,
    });
    openByPrefix.delete(prefix);
  }

  return matches;
}

export function joinLineRange(lines: readonly string[], start: number, end: number): string {
  let output = '';
  for (let index = start; index < end; index += 1) {
    if (index > start) output += '\n';
    output += lines[index] ?? '';
  }
  return output;
}

export function collectMathBlockFenceReferences(markdown: string): MathBlockFenceReference[] {
  const references: MathBlockFenceReference[] = [];
  mapMarkdownOutsideProtectedSegments(markdown, (segment) => {
    collectMathBlockFenceReferencesFromSegment(segment, references);
    return segment;
  }, { protectMathBlocks: false });
  return references;
}

export function collectMathBlockFenceReferencesFromSegment(
  segment: string,
  references: MathBlockFenceReference[]
): void {
  const lines = segment.split('\n');
  const dollarFenceMatches = collectDollarMathFenceMatches(lines);

  for (let index = 0; index < lines.length; index += 1) {
    const standaloneDollar = STANDALONE_DOLLAR_MATH_PATTERN.exec(lines[index]);
    if (standaloneDollar) {
      const prefix = standaloneDollar[1] ?? '';
      references.push({
        latex: `${prefix}${standaloneDollar[2] ?? ''}`,
        style: 'dollar-inline',
      });
      continue;
    }

    const standaloneBracket = STANDALONE_BRACKET_MATH_PATTERN.exec(lines[index]);
    if (standaloneBracket) {
      const prefix = standaloneBracket[1] ?? '';
      references.push({
        latex: `${prefix}${standaloneBracket[2] ?? ''}`,
        style: 'bracket-inline',
      });
      continue;
    }

    const dollarMatch = dollarFenceMatches.get(index);
    if (dollarMatch) {
      references.push({
        latex: joinLineRange(lines, index + 1, dollarMatch.closeIndex),
        style: 'dollar',
      });
      index = dollarMatch.closeIndex;
      continue;
    }

    const alternativeOpen = ALTERNATIVE_MATH_BLOCK_OPEN_PATTERN.exec(lines[index]);
    if (!alternativeOpen) continue;

    const pendingFence = {
      prefix: alternativeOpen[1] ?? '',
      bracketCloseFence: isAlternativeMathBlockBracketCloseFence(alternativeOpen[2] ?? ''),
      bracketOnlyFence: lines[index].trim() === '[',
    };
    const content: string[] = [];
    let closeIndex = -1;
    let inlineCloseContent: string | null = null;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const close = getAlternativeMathBlockClose(lines[cursor], pendingFence);
      if (close) {
        inlineCloseContent = close.contentLine;
        if (close.bracketClose && inlineCloseContent === null && content.length > 0) {
          const lastIndex = content.length - 1;
          content[lastIndex] = stripSingleTrailingBackslash(content[lastIndex] ?? '');
        } else if (close.bracketClose && inlineCloseContent !== null) {
          inlineCloseContent = stripSingleTrailingBackslash(inlineCloseContent);
        }
        closeIndex = cursor;
        break;
      }
      content.push(lines[cursor]);
    }

    if (closeIndex < 0) continue;
    const fullContent = inlineCloseContent === null ? content : [...content, inlineCloseContent];
    if (!pendingFence.bracketOnlyFence || isLatexLikeMathBlock(fullContent)) {
      references.push({
        latex: fullContent.join('\n'),
        style: 'bracket',
      });
      index = closeIndex;
    }
  }
}

function stripMathContainerPrefix(line: string, prefix: string): string {
  return prefix && line.startsWith(prefix) ? line.slice(prefix.length) : line;
}

export function normalizeMathBlockLatex(latex: string): string {
  return latex.replace(/\r\n?/g, '\n').trim();
}
