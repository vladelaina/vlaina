import { slashCommandDefinitions } from './slashCommandDefinitions';
import type { SlashMenuItem } from './types';

export const slashMenuItems: SlashMenuItem[] = slashCommandDefinitions.map((definition) => ({
  id: definition.id,
  name: definition.name,
  icon: definition.icon,
  searchTerms: [...definition.searchTerms],
  commandId: definition.commandId,
}));
