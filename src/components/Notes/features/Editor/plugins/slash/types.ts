import type { SlashCommandId } from './slashCommandDefinitions';

export interface SlashMenuItem {
  id: string;
  name: string;
  icon: string;
  searchTerms: string[];
  commandId: SlashCommandId;
}

export interface SlashMenuState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
}
