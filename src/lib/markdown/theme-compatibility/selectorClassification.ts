import {
  OBSIDIAN_APP_CHROME_CLASSES,
  OBSIDIAN_EXTENSION_SELECTOR_PATTERNS,
  OBSIDIAN_PAGE_CHROME_IDS,
  OBSIDIAN_PAGE_CHROME_SELECTOR_PATTERNS,
  OBSIDIAN_PLUGIN_CHROME_CLASSES,
  OBSIDIAN_THEME_SETTING_OR_PLUGIN_CLASSES,
} from './obsidian/selectorClassification';
import {
  TYPORA_APP_CHROME_CLASSES,
  TYPORA_EDITOR_CHROME_CLASSES,
  TYPORA_PAGE_CHROME_IDS,
  TYPORA_PAGE_CHROME_SELECTOR_PATTERNS,
  VLOOK_APP_CHROME_CLASSES,
  VLOOK_THEME_SETTING_OR_EXTENSION_CLASSES,
} from './typora/selectorClassification';

function classSelectorPattern(classNamePattern: string): RegExp {
  return new RegExp(String.raw`\.(?:${classNamePattern})(?=$|[^\w-])`, 'i');
}

function idSelectorPattern(idPattern: string): RegExp {
  return new RegExp(String.raw`#(?:${idPattern})(?=$|[^\w-])`, 'i');
}

const TYPOGRAPHIC_ICON_CHROME = String.raw`fa(?:-[\w-]+)?|ion-[\w-]+|ty-icon|ty-md-radio-button-[\w-]+`;

const IMPORTED_PAGE_CHROME_SELECTOR_PATTERNS = [
  classSelectorPattern([
    TYPOGRAPHIC_ICON_CHROME,
    TYPORA_APP_CHROME_CLASSES,
    TYPORA_EDITOR_CHROME_CLASSES,
    VLOOK_APP_CHROME_CLASSES,
    OBSIDIAN_APP_CHROME_CLASSES,
    OBSIDIAN_PLUGIN_CHROME_CLASSES,
  ].join('|')),
  idSelectorPattern([TYPORA_PAGE_CHROME_IDS, OBSIDIAN_PAGE_CHROME_IDS].join('|')),
  ...TYPORA_PAGE_CHROME_SELECTOR_PATTERNS,
  ...OBSIDIAN_PAGE_CHROME_SELECTOR_PATTERNS,
  /(?:^|[\s>+~])(?:button|input)(?=$|[\s.#:[>+~])/i,
  /\[data-markdown-theme-root="true"\]\[[^\]]+\]\s*>\s*div(?:$|[\s.#:[>+~])/i,
];

const KNOWN_EXTERNAL_EXTENSION_SELECTOR_PATTERNS = [
  classSelectorPattern([
    OBSIDIAN_THEME_SETTING_OR_PLUGIN_CLASSES,
    VLOOK_THEME_SETTING_OR_EXTENSION_CLASSES,
  ].join('|')),
  ...OBSIDIAN_EXTENSION_SELECTOR_PATTERNS,
];

export function selectorTargetsImportedPageChrome(selector: string): boolean {
  return IMPORTED_PAGE_CHROME_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector));
}

export function selectorTargetsKnownExternalExtension(selector: string): boolean {
  return KNOWN_EXTERNAL_EXTENSION_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector));
}
