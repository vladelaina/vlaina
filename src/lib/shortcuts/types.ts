export type ShortcutScope = 'global' | 'notes' | 'calendar' | 'chat';

export interface ShortcutConfig {
  id: string;
  keys: string[];
  description: string;
  scope?: ShortcutScope;
  isSystem?: boolean;
}

export type ShortcutHandler = () => void | Promise<void>;

export type ShortcutHandlers = Record<string, ShortcutHandler>;
