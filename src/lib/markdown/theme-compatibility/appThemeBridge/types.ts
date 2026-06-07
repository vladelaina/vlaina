export type ThemeColorSchemeBucket = 'base' | 'dark' | 'light';

export interface CollectedThemeCustomProperties {
  base: Map<string, string>;
  dark: Map<string, string>;
  light: Map<string, string>;
}

export interface VlainaThemeMapping {
  target: string;
  sources: string[];
}
