import type { IconName } from '@/components/ui/icons';
import type { MessageKey } from '@/lib/i18n';
import type { SlashCommandId } from './slashCommandDefinitions';

export interface SlashMenuItem {
  id: string;
  nameKey: MessageKey;
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
