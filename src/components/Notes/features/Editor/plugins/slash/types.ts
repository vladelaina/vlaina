// Slash menu plugin types
import type { ReactNode } from 'react';
import type { Ctx } from '@milkdown/kit/ctx';

export interface SlashMenuItem {
  name: string;
  icon: ReactNode;
  description?: string;
  group: string;
  action: (ctx: Ctx) => void;
  searchAlias?: string[];
}

export interface SlashMenuSubMenu extends Omit<SlashMenuItem, 'action'> {
  subMenu: SlashMenuItem[];
}

export interface SlashMenuState {
  isOpen: boolean;
  query: string;
  position: { x: number; y: number };
  selectedIndex: number;
}
