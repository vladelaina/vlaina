import { translate } from '@/lib/i18n';
import { getMessageVariants } from '@/lib/i18n/messages';
import { getSlashMenuItems } from './slashItems';
import { getSlashUsageRank } from './slashUsageOrder';
import type { SlashMenuItem } from './types';

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '');
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

function getEditDistanceWithinLimit(query: string, value: string, limit: number) {
  if (Math.abs(query.length - value.length) > limit) {
    return null;
  }

  let previous = Array.from({ length: value.length + 1 }, (_, index) => index);

  for (let queryIndex = 1; queryIndex <= query.length; queryIndex += 1) {
    const current = [queryIndex];
    let rowBest = current[0];

    for (let valueIndex = 1; valueIndex <= value.length; valueIndex += 1) {
      const substitutionCost = query[queryIndex - 1] === value[valueIndex - 1] ? 0 : 1;
      const distance = Math.min(
        previous[valueIndex] + 1,
        current[valueIndex - 1] + 1,
        previous[valueIndex - 1] + substitutionCost
      );
      current[valueIndex] = distance;
      rowBest = Math.min(rowBest, distance);
    }

    if (rowBest > limit) {
      return null;
    }

    previous = current;
  }

  const distance = previous[value.length];
  return distance <= limit ? distance : null;
}

function getFuzzyTypoScore(query: string, candidate: string) {
  if (query.length < 2) {
    return null;
  }

  const typoLimit = query.length >= 5 ? 2 : 1;
  const compactCandidate = candidate.replace(/[\s\-_./]+/g, '');
  const values = [compactCandidate, ...tokenize(candidate)];

  for (const value of values) {
    const distance = getEditDistanceWithinLimit(query, value, typoLimit);
    if (distance !== null) {
      return 5 + distance;
    }
  }

  return null;
}

function getNumericAliasScore(query: string, candidate: string) {
  const queryNumber = query.match(/\d$/)?.[0];
  if (!queryNumber || query.length < 2 || !/[a-z]/.test(query)) {
    return null;
  }

  const values = [candidate.replace(/[\s\-_./]+/g, ''), ...tokenize(candidate)];
  return values.some((value) => /^[a-z]{1,3}\d$/.test(value) && value.endsWith(queryNumber))
    ? 8
    : null;
}

function scoreCandidate(query: string, candidate: string) {
  if (!candidate) return null;

  if (candidate === query) return 0;
  if (query.length === 1 && /[a-z]/.test(query)) {
    return candidate.length <= 3 && candidate.startsWith(query) ? 1 : null;
  }
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;

  const initials = getInitials(candidate);
  if (initials && initials.startsWith(query)) return 3;

  if (isSubsequence(query, candidate)) return 4;

  return getFuzzyTypoScore(query, candidate) ?? getNumericAliasScore(query, candidate);
}

function scoreSlashItem(query: string, item: SlashMenuItem) {
  const candidates = [
    { value: item.name, penalty: 0 },
    { value: translate(item.nameKey), penalty: 0 },
    { value: item.id, penalty: 0 },
    { value: item.commandId, penalty: 0 },
    ...item.searchTerms.map((value) => ({ value, penalty: 0 })),
    ...getMessageVariants(item.nameKey).map((value) => ({ value, penalty: 4 })),
  ].map(({ value, penalty }) => ({ value: normalize(value), penalty }));
  let bestScore: number | null = null;

  for (const { value, penalty } of candidates) {
    const score = scoreCandidate(query, value);
    if (score === null) continue;
    const weightedScore = score + penalty;
    bestScore = bestScore === null ? weightedScore : Math.min(bestScore, weightedScore);
  }

  return bestScore;
}

function adjustSlashItemScore(query: string, item: SlashMenuItem, score: number) {
  if (item.id === 'frontmatter' && query.length <= 2 && query !== 'fm') {
    return score + 10;
  }

  return score;
}

export function filterSlashItems(query: string, items: readonly SlashMenuItem[] = getSlashMenuItems()) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [...items];

  return items
    .map((item, index) => {
      const score = scoreSlashItem(normalizedQuery, item);
      return {
        item,
        index,
        score: score === null ? null : adjustSlashItemScore(normalizedQuery, item, score),
      };
    })
    .filter((entry): entry is typeof entry & { score: number } => entry.score !== null)
    .sort((a, b) => (
      a.score - b.score
      || getSlashUsageRank(a.item.commandId) - getSlashUsageRank(b.item.commandId)
      || a.index - b.index
    ))
    .map((entry) => entry.item);
}
