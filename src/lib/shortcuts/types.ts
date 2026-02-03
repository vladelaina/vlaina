export type ShortcutScope = 'global' | 'notes' | 'calendar';

export interface ShortcutConfig {
  id: string;
  keys: string[];
  description: string;
  scope?: ShortcutScope;
}

export type ShortcutHandler = () => void | Promise<void>;

export type ShortcutHandlers = Record<string, ShortcutHandler>;
