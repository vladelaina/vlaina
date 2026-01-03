/** Shortcut scope */
export type ShortcutScope = 'global' | 'notes' | 'calendar';

/** Shortcut configuration */
export interface ShortcutConfig {
  id: string;
  keys: string[];
  description: string;
  scope?: ShortcutScope;
}

/** Shortcut handler */
export type ShortcutHandler = () => void | Promise<void>;

/** Shortcut handlers map */
export type ShortcutHandlers = Record<string, ShortcutHandler>;
