import type { IconName } from '@/components/ui/icons';
import type { SlashCommandId } from './slashCommandDefinitions';

export interface SlashMenuItem {
  id: string;
  name: string;
  icon: IconName;
  searchTerms: string[];
  commandId: SlashCommandId;
}

export interface SlashMenuState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
}
