export const OPEN_SETTINGS_EVENT = 'open-settings';
export const REQUEST_CLOSE_SETTINGS_EVENT = 'settings:request-close';
export const SETTINGS_BEFORE_CLOSE_EVENT = 'settings:before-close';
export const SETTINGS_CLOSED_EVENT = 'settings:closed';

export type SettingsTab = 'markdown' | 'appearance' | 'language' | 'ai' | 'about';
export type SettingsOpenTab = SettingsTab | 'feedback';

export interface OpenSettingsDetail {
  tab?: SettingsOpenTab;
}

export function resolveSettingsOpenTab(tab: unknown): SettingsTab | null {
  if (!tab) return null;
  if (tab === 'feedback') return 'about';
  if (
    tab === 'markdown' ||
    tab === 'appearance' ||
    tab === 'language' ||
    tab === 'ai' ||
    tab === 'about'
  ) {
    return tab;
  }
  return null;
}
