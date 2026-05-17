import { translate } from '@/lib/i18n';
import { slashCommandDefinitions } from './slashCommandDefinitions';
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

export const slashMenuItems: SlashMenuItem[] = slashCommandDefinitions.map(toSlashMenuItem);

export function getSlashMenuItems(): SlashMenuItem[] {
  return slashCommandDefinitions.map(toSlashMenuItem);
}
