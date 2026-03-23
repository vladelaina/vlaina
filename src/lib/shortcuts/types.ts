export type ShortcutScope = 'global' | 'notes' | 'chat';
export type ShortcutModule = 'notes' | 'chat';
export type ShortcutSection = 'General' | 'Notes' | 'Chat';

export interface ShortcutConfig {
  id: string;
  keys: string[];
  description: string;
  scope?: ShortcutScope;
  isSystem?: boolean;
}

export interface ShortcutDefinition extends ShortcutConfig {
  action: string;
  modules: ShortcutModule[];
  section: ShortcutSection;
}

export interface ShortcutKeyboardEventLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export type ShortcutHandler = () => void | Promise<void>;

export type ShortcutHandlers = Record<string, ShortcutHandler>;
