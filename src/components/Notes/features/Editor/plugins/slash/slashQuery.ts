import { slashMenuItems } from './slashItems';
import type { SlashMenuItem } from './types';

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function tokenize(value: string) {
  return normalize(value).split(/[\s\-_./]+/).filter(Boolean);
}

function getInitials(value: string) {
  return tokenize(value).map((token) => token[0]).join('');
}

function isSubsequence(query: string, value: string) {
  if (!query) return true;

  let queryIndex = 0;
  for (const char of value) {
    if (char === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) {
        return true;
      }
    }
  }

  return false;
}

function scoreCandidate(query: string, candidate: string) {
  if (!candidate) return null;

  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;

  const initials = getInitials(candidate);
  if (initials && initials.startsWith(query)) return 3;

  if (isSubsequence(query, candidate)) return 4;

  return null;
}

function scoreSlashItem(query: string, item: SlashMenuItem) {
  const candidates = [item.name, item.id, item.commandId, ...item.searchTerms].map(normalize);
  let bestScore: number | null = null;

  for (const candidate of candidates) {
    const score = scoreCandidate(query, candidate);
    if (score === null) continue;
    bestScore = bestScore === null ? score : Math.min(bestScore, score);
  }

  return bestScore;
}

export function filterSlashItems(query: string, items: readonly SlashMenuItem[] = slashMenuItems) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [...items];

  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreSlashItem(normalizedQuery, item),
    }))
    .filter((entry): entry is typeof entry & { score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.item);
}
