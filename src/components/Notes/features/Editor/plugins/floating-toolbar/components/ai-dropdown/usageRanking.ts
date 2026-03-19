import { AI_PROMPT_GROUPS } from '../../ai/promptCatalog';
import type { AiMenuGroup } from './types';

const STORAGE_KEY = 'nekotick_editor_ai_menu_usage';
const SORTED_GROUP_IDS = new Set(['actions', 'tone']);

type UsageCounts = Record<string, number>;
type UsageState = Record<string, UsageCounts>;

function readUsageState(): UsageState {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed as UsageState;
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
    ...AI_PROMPT_GROUPS.filter((group) => group.id !== 'translate'),
    ...AI_PROMPT_GROUPS.filter((group) => group.id === 'translate'),
  ];

  return orderedGroups.map((group) => ({
    ...group,
    items: sortGroupItems(group, usageState),
  }));
}

export function recordAiMenuItemUsage(groupId: string, itemId: string) {
  if (!SORTED_GROUP_IDS.has(groupId)) {
    return;
  }

  const state = readUsageState();
  const groupUsage = state[groupId] ?? {};
  const nextCount = getItemUsage(state, groupId, itemId) + 1;

  writeUsageState({
    ...state,
    [groupId]: {
      ...groupUsage,
      [itemId]: nextCount,
    },
  });
}
