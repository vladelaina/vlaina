import { collectThemeCustomProperties } from './collector';
import { TYPORA_FIXED_LIGHT_APP_EFFECT_DECLARATIONS } from './effects';
import { TYPORA_FIXED_LIGHT_APP_FALLBACK_DECLARATIONS } from './fixedLightFallbacks';
import { escapeCssString, renderRule } from './render';
import type { MarkdownThemePlatform } from '../types';

const ROOT_SELECTOR = ':root';

export function buildImportedAppThemeCss(
  css: string,
  importedThemeId: string,
  platform: MarkdownThemePlatform
): string {
  const { base, dark, light } = collectThemeCustomProperties(css);
  const fixedLightBase = platform === 'typora'
    ? mergeCustomProperties(base, light)
    : base;
  const extraDeclarations = platform === 'typora'
    ? [
        ...TYPORA_FIXED_LIGHT_APP_FALLBACK_DECLARATIONS,
        ...TYPORA_FIXED_LIGHT_APP_EFFECT_DECLARATIONS,
      ]
    : [];

  if (
    fixedLightBase.size === 0
    && extraDeclarations.length === 0
    && (platform === 'typora' || dark.size === 0)
    && (platform === 'typora' || light.size === 0)
  ) {
    return '';
  }

  const attributeSelector = `[data-vlaina-imported-app-theme="${escapeCssString(importedThemeId)}"]`;
  const rules = [
    renderRule(`${ROOT_SELECTOR}${attributeSelector}`, fixedLightBase, {
      colorScheme: platform === 'typora' ? 'light' : 'light dark',
      extraDeclarations,
    }),
  ];

  if (platform === 'typora') {
    return rules.join('\n\n');
  }

  if (light.size > 0) {
    rules.push(renderRule(`${ROOT_SELECTOR}${attributeSelector}.light`, light));
  }

  if (dark.size > 0) {
    rules.push(renderRule(`${ROOT_SELECTOR}${attributeSelector}.dark`, dark));
  }

  return rules.join('\n\n');
}

function mergeCustomProperties(
  base: Map<string, string>,
  overrides: Map<string, string>
): Map<string, string> {
  if (overrides.size === 0) return base;
  return new Map([...base, ...overrides]);
}
