import { translate } from '@/lib/i18n';
import { slashCommandDefinitions } from './slashCommandDefinitions';
import { getSlashUsageRank } from './slashUsageOrder';
import type { SlashMenuItem } from './types';

function toSlashMenuItem(definition: (typeof slashCommandDefinitions)[number]): SlashMenuItem {
  return {
    id: definition.id,
    nameKey: definition.nameKey,
    name: translate(definition.nameKey),
    icon: definition.icon,
    searchTerms: [...definition.searchTerms],
    commandId: definition.commandId,
  };
}

function buildSlashMenuItems() {
  return slashCommandDefinitions
    .map(toSlashMenuItem)
    .sort((a, b) => getSlashUsageRank(a.commandId) - getSlashUsageRank(b.commandId));
}

export const slashMenuItems: SlashMenuItem[] = buildSlashMenuItems();

export function getSlashMenuItems(): SlashMenuItem[] {
  return buildSlashMenuItems();
}
