import { collectThemeCustomProperties } from './collector';
import { escapeCssString, renderRule } from './render';

const ROOT_SELECTOR = ':root';

export function buildImportedAppThemeCss(css: string, importedThemeId: string): string {
  const { base, dark, light } = collectThemeCustomProperties(css);
  if (base.size === 0 && dark.size === 0 && light.size === 0) {
    return '';
  }

  const attributeSelector = `[data-vlaina-imported-app-theme="${escapeCssString(importedThemeId)}"]`;
  const rules = [
    renderRule(`${ROOT_SELECTOR}${attributeSelector}`, base),
  ];

  if (light.size > 0) {
    rules.push(renderRule(`${ROOT_SELECTOR}${attributeSelector}.light`, light));
  }

  if (dark.size > 0) {
    rules.push(renderRule(`${ROOT_SELECTOR}${attributeSelector}.dark`, dark));
  }

  return rules.join('\n\n');
}
