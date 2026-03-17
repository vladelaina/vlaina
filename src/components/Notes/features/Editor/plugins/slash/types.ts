import type { SlashCommandId } from './slashCommands';

export interface SlashMenuItem {
  id: string;
  name: string;
  icon: string;
  description?: string;
  group: string;
  searchTerms: string[];
  commandId: SlashCommandId;
}

export interface SlashMenuState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
}
