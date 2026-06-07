import type { VlainaThemeMapping } from './types';

const TYPORA_TEXT_FONT_SOURCES = ['--v-fm-text', '--v-fm-text-local'];
const TYPORA_INTERFACE_FONT_SOURCES = ['--v-fm-bd', '--v-fm-bd-local'];
const TYPORA_MONOSPACE_FONT_SOURCES = ['--v-fm-code', '--v-fm-code-local'];

const OBSIDIAN_TEXT_FONT_SOURCES = ['--font-text', '--font-text-theme'];
const OBSIDIAN_INTERFACE_FONT_SOURCES = ['--font-interface', '--font-interface-theme'];
const OBSIDIAN_MONOSPACE_FONT_SOURCES = ['--font-monospace', '--font-monospace-theme'];

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
