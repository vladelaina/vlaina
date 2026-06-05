import { AI_PROMPT_GROUPS } from '../../ai/promptCatalog';
import type { AiMenuGroup } from './types';

const STORAGE_KEY = 'vlaina_editor_ai_menu_usage';
const SORTED_GROUP_IDS = new Set(['actions', 'tone']);
const MAX_USAGE_STORAGE_CHARS = 16 * 1024;
const MAX_USAGE_COUNT = 1_000_000;

type UsageCounts = Record<string, number>;
type UsageState = Record<string, UsageCounts>;

const SORTED_GROUP_ITEM_IDS = new Map(
  AI_PROMPT_GROUPS
    .filter((group) => SORTED_GROUP_IDS.has(group.id))
    .map((group) => [group.id, new Set(group.items.map((item) => item.id))]),
);

function normalizeUsageState(value: unknown): UsageState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const rawState = value as Record<string, unknown>;
  const state: UsageState = {};
  for (const [groupId, itemIds] of SORTED_GROUP_ITEM_IDS) {
    const rawGroup = rawState[groupId];
    if (!rawGroup || typeof rawGroup !== 'object' || Array.isArray(rawGroup)) {
      continue;
    }

    const counts: UsageCounts = {};
    const rawCounts = rawGroup as Record<string, unknown>;
    for (const itemId of itemIds) {
      const count = rawCounts[itemId];
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
        continue;
      }
      counts[itemId] = Math.min(Math.trunc(count), MAX_USAGE_COUNT);
    }

    if (Object.keys(counts).length > 0) {
      state[groupId] = counts;
    }
  }

  return state;
}

function readUsageState(): UsageState {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    if (raw.length > MAX_USAGE_STORAGE_CHARS) {
      return {};
    }

    return normalizeUsageState(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writeUsageState(state: UsageState) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
  }
}

function getItemUsage(state: UsageState, groupId: string, itemId: string): number {
  const count = state[groupId]?.[itemId];
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

function sortGroupItems(group: AiMenuGroup, state: UsageState): AiMenuGroup['items'] {
  if (!SORTED_GROUP_IDS.has(group.id)) {
    return group.items;
  }

  return [...group.items].sort((left, right) => {
    const usageDiff = getItemUsage(state, group.id, right.id) - getItemUsage(state, group.id, left.id);
    if (usageDiff !== 0) {
      return usageDiff;
    }

    return group.items.findIndex((item) => item.id === left.id) - group.items.findIndex((item) => item.id === right.id);
  });
}

export function getAiMenuGroups(): readonly AiMenuGroup[] {
  const usageState = readUsageState();
  const orderedGroups = [
    ...AI_PROMPT_GROUPS.filter((group) => group.id !== 'translate' && group.id !== 'sidebar'),
    ...AI_PROMPT_GROUPS.filter((group) => group.id === 'translate'),
    ...AI_PROMPT_GROUPS.filter((group) => group.id === 'sidebar'),
  ];

  return orderedGroups.map((group) => ({
    ...group,
    items: sortGroupItems(group, usageState),
  }));
}

export function recordAiMenuItemUsage(groupId: string, itemId: string) {
  if (!SORTED_GROUP_ITEM_IDS.get(groupId)?.has(itemId)) {
    return;
  }

  const state = readUsageState();
  const groupUsage = state[groupId] ?? {};
  const nextCount = Math.min(getItemUsage(state, groupId, itemId) + 1, MAX_USAGE_COUNT);

  writeUsageState({
    ...state,
    [groupId]: {
      ...groupUsage,
      [itemId]: nextCount,
    },
  });
}
