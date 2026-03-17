import { slashMenuItems } from './slashItems';
import type { SlashMenuItem } from './types';

export function filterSlashItems(query: string, items: readonly SlashMenuItem[] = slashMenuItems) {
  if (!query) return [...items];

  const lowerQuery = query.toLowerCase();

  return items.filter((item) => {
    if (item.name.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return item.searchTerms.some((term) => term.toLowerCase().includes(lowerQuery));
  });
}

export function groupSlashItems(items: readonly SlashMenuItem[]) {
  const groups = new Map<string, SlashMenuItem[]>();

  items.forEach((item) => {
    const group = groups.get(item.group) ?? [];
    group.push(item);
    groups.set(item.group, group);
  });

  return groups;
}
