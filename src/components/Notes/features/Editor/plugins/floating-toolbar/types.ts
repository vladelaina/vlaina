// Floating Toolbar Plugin Types

import type { EditorView } from '@milkdown/kit/prose/view';

// Block types supported by the toolbar
export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'codeBlock';

// Sub-menu types
export type SubMenuType = 'block' | 'link' | 'color' | null;

// Toolbar placement relative to selection
export type ToolbarPlacement = 'top' | 'bottom';

// Main plugin state
export interface FloatingToolbarState {
  isVisible: boolean;
  position: { x: number; y: number };
  placement: ToolbarPlacement;
  activeMarks: Set<string>;
  currentBlockType: BlockType;
  linkUrl: string | null;
  textColor: string | null;
  bgColor: string | null;
  subMenu: SubMenuType;
}

// Toolbar action definition
export interface ToolbarAction {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  isActive?: (state: FloatingToolbarState) => boolean;
  execute: (view: EditorView, state: FloatingToolbarState) => void;
}

// Color option for the color picker
export interface ColorOption {
  id: string;
  label: string;
  textColor?: string;
  bgColor?: string;
}

// Block type configuration
export interface BlockTypeConfig {
  type: BlockType;
  label: string;
  icon: string;
  shortcut?: string;
}

// Plugin meta actions
export const TOOLBAR_ACTIONS = {
  SHOW: 'SHOW',
  HIDE: 'HIDE',
  UPDATE_POSITION: 'UPDATE_POSITION',
  SET_ACTIVE_MARKS: 'SET_ACTIVE_MARKS',
  SET_BLOCK_TYPE: 'SET_BLOCK_TYPE',
  SET_SUB_MENU: 'SET_SUB_MENU',
  SET_LINK_URL: 'SET_LINK_URL',
  SET_TEXT_COLOR: 'SET_TEXT_COLOR',
  SET_BG_COLOR: 'SET_BG_COLOR',
} as const;

export type ToolbarActionType = typeof TOOLBAR_ACTIONS[keyof typeof TOOLBAR_ACTIONS];

// Meta payload for state updates
export interface ToolbarMeta {
  type: ToolbarActionType;
  payload?: Partial<FloatingToolbarState>;
}