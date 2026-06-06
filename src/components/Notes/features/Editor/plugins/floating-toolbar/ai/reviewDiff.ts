type DiffPartType = 'equal' | 'added' | 'removed';

interface DiffPart {
  type: DiffPartType;
  text: string;
}

const MAX_DIFF_MATRIX_CELLS = 200_000;
const MAX_DIFF_TOKENS = MAX_DIFF_MATRIX_CELLS + 1;
const whitespaceCharRe = /\s/u;
const whitespaceRunRe = /\s/u;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface TokenizeResult {
  tokens: string[];
  truncated: boolean;
}

function tokenizeText(value: string): string[] {
  return tokenizeTextWithLimit(value, Number.POSITIVE_INFINITY).tokens;
}

function tokenizeTextWithLimit(value: string, maxTokens = MAX_DIFF_TOKENS): TokenizeResult {
  if (!value) {
    return { tokens: [], truncated: false };
  }

  const tokens: string[] = [];
  const pushToken = (token: string) => {
    if (!token) {
      return true;
    }
    if (tokens.length >= maxTokens) {
      return false;
    }
    tokens.push(token);
    return true;
  };

  if (!whitespaceRunRe.test(value)) {
    for (const char of value) {
      if (!pushToken(char)) {
        return { tokens, truncated: true };
      }
    }
    return { tokens, truncated: false };
  }

  let runStart = 0;
  let runIsWhitespace: boolean | null = null;
  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    const charLength = codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
    const char = value.slice(index, index + charLength);
    const isWhitespace = whitespaceCharRe.test(char);

    if (runIsWhitespace === null) {
      runIsWhitespace = isWhitespace;
    } else if (isWhitespace !== runIsWhitespace) {
      if (!pushToken(value.slice(runStart, index))) {
        return { tokens, truncated: true };
      }
      runStart = index;
      runIsWhitespace = isWhitespace;
    }

    index += charLength;
  }

  return pushToken(value.slice(runStart))
    ? { tokens, truncated: false }
    : { tokens, truncated: true };
}

function mergeDiffParts(parts: DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = [];

  parts.forEach((part) => {
    if (!part.text) {
      return;
    }

    const previous = merged[merged.length - 1];
    if (previous && previous.type === part.type) {
      previous.text += part.text;
      return;
    }

    merged.push({ ...part });
  });

  return merged;
}

function diffTokens(previousText: string, nextText: string): DiffPart[] {
  const previousResult = tokenizeTextWithLimit(previousText);
  const nextResult = tokenizeTextWithLimit(nextText);
  const previousTokens = previousResult.tokens;
  const nextTokens = nextResult.tokens;
  if (
    previousResult.truncated ||
    nextResult.truncated ||
    previousTokens.length * nextTokens.length > MAX_DIFF_MATRIX_CELLS
  ) {
    return mergeDiffParts([
      { type: 'removed', text: previousText },
      { type: 'added', text: nextText },
    ]);
  }

  const rows = previousTokens.length + 1;
  const cols = nextTokens.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      if (previousTokens[row - 1] === nextTokens[col - 1]) {
        matrix[row][col] = matrix[row - 1][col - 1] + 1;
        continue;
      }

      matrix[row][col] = Math.max(matrix[row - 1][col], matrix[row][col - 1]);
    }
  }

  const parts: DiffPart[] = [];
  let row = previousTokens.length;
  let col = nextTokens.length;

  while (row > 0 && col > 0) {
    if (previousTokens[row - 1] === nextTokens[col - 1]) {
      parts.push({ type: 'equal', text: previousTokens[row - 1] });
      row -= 1;
      col -= 1;
      continue;
    }

    if (matrix[row - 1][col] >= matrix[row][col - 1]) {
      parts.push({ type: 'removed', text: previousTokens[row - 1] });
      row -= 1;
      continue;
    }

    parts.push({ type: 'added', text: nextTokens[col - 1] });
    col -= 1;
  }

  while (row > 0) {
    parts.push({ type: 'removed', text: previousTokens[row - 1] });
    row -= 1;
  }

  while (col > 0) {
    parts.push({ type: 'added', text: nextTokens[col - 1] });
    col -= 1;
  }

  return mergeDiffParts(parts.reverse());
}

export function renderAiReviewDiffMarkup(previousText: string, nextText: string): string {
  return diffTokens(previousText, nextText)
    .map((part) => {
      const content = escapeHtml(part.text);

      if (part.type === 'added') {
        return `<ins class="ai-review-diff-added">${content}</ins>`;
      }

      if (part.type === 'removed') {
        return `<del class="ai-review-diff-removed">${content}</del>`;
      }

      return content;
    })
    .join('');
}

export const __testing__ = {
  diffTokens,
  tokenizeText,
  tokenizeTextWithLimit,
  renderAiReviewDiffMarkup,
};
