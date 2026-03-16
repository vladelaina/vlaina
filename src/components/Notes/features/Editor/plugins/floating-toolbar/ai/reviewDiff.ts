type DiffPartType = 'equal' | 'added' | 'removed';

interface DiffPart {
  type: DiffPartType;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tokenizeText(value: string): string[] {
  if (!value) {
    return [];
  }

  if (/\s/u.test(value)) {
    return value.match(/(\s+|[^\s]+)/gu) ?? [];
  }

  return Array.from(value);
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
  const previousTokens = tokenizeText(previousText);
  const nextTokens = tokenizeText(nextText);
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
  renderAiReviewDiffMarkup,
};
