import type { VlainaThemeMapping } from './types';
import {
  OBSIDIAN_INTERFACE_FONT_SOURCES,
  OBSIDIAN_MONOSPACE_FONT_SOURCES,
  OBSIDIAN_TEXT_FONT_SOURCES,
} from '../obsidian/fontSources';
import {
  TYPORA_INTERFACE_FONT_SOURCES,
  TYPORA_MONOSPACE_FONT_SOURCES,
  TYPORA_TEXT_FONT_SOURCES,
} from '../typora/appTheme/fontSources';

export const VLAINA_FONT_THEME_MAPPINGS: VlainaThemeMapping[] = [
  {
    target: '--font-sans',
    sources: [
      ...TYPORA_TEXT_FONT_SOURCES,
      ...OBSIDIAN_TEXT_FONT_SOURCES,
      ...OBSIDIAN_INTERFACE_FONT_SOURCES,
    ],
  },
  {
    target: '--font-mono',
    sources: [
      ...TYPORA_MONOSPACE_FONT_SOURCES,
      ...OBSIDIAN_MONOSPACE_FONT_SOURCES,
    ],
  },
  {
    target: '--font-text',
    sources: [
      ...TYPORA_TEXT_FONT_SOURCES,
      '--font-text-theme',
    ],
  },
  {
    target: '--font-interface',
    sources: [
      ...TYPORA_INTERFACE_FONT_SOURCES,
      '--font-interface-theme',
    ],
  },
  {
    target: '--font-monospace',
    sources: [
      ...TYPORA_MONOSPACE_FONT_SOURCES,
      '--font-monospace-theme',
    ],
  },
];
