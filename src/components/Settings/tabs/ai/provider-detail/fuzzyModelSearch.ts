export function normalizeFuzzySearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function getFuzzySearchScore(text: string, query: string): number | null {
  const normalizedText = normalizeFuzzySearchText(text);
  const normalizedQuery = normalizeFuzzySearchText(query);

  if (!normalizedQuery) {
    return 0;
  }

  if (!normalizedText) {
    return null;
  }

  if (normalizedText === normalizedQuery) {
    return 0;
  }

  if (normalizedText.startsWith(normalizedQuery)) {
    return 10 + normalizedText.length - normalizedQuery.length;
  }

  const includesIndex = normalizedText.indexOf(normalizedQuery);
  if (includesIndex >= 0) {
    return 50 + includesIndex * 2 + normalizedText.length - normalizedQuery.length;
  }

  let textIndex = 0;
  let score = 120;
  let previousMatchIndex = -1;

  for (const queryChar of normalizedQuery) {
    const matchIndex = normalizedText.indexOf(queryChar, textIndex);
    if (matchIndex < 0) {
      return null;
    }

    if (previousMatchIndex >= 0) {
      score += Math.max(0, matchIndex - previousMatchIndex - 1);
    } else {
      score += matchIndex * 2;
    }

    previousMatchIndex = matchIndex;
    textIndex = matchIndex + 1;
  }

  return score + normalizedText.length - normalizedQuery.length;
}

export function rankByFuzzySearch<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string
): T[] {
  const normalizedQuery = normalizeFuzzySearchText(query);
  if (!normalizedQuery) {
    return items;
  }

  return items
    .map((item, index) => ({
      item,
      index,
      score: getFuzzySearchScore(getSearchText(item), normalizedQuery),
    }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((entry) => entry.item);
}
