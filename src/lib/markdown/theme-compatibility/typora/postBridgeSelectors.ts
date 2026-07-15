import { getImportedMarkdownThemeScopeSelector } from '../dom';

export type CssLines = string[];

export function getTyporaWriteSelector(importedThemeId: string): string {
  const rootScope = `${getImportedMarkdownThemeScopeSelector(importedThemeId)}.theme-typora`;
  return `:is(${rootScope}#write, ${rootScope} #write)`;
}

export function getTyporaRootSelector(importedThemeId: string): string {
  return `${getImportedMarkdownThemeScopeSelector(importedThemeId)}.theme-typora`;
}

export function cssRule(selectors: string | string[], declarations: string[]): CssLines {
  const selectorLines = Array.isArray(selectors)
    ? selectors.map((selector, index) => `${selector}${index === selectors.length - 1 ? ' {' : ','}`)
    : [`${selectors} {`];

  return [
    ...selectorLines,
    ...declarations.map((declaration) => `  ${declaration}`),
    '}',
    '',
  ];
}

export function important(property: string, value: string): string {
  return `${property}: ${value} !important;`;
}

export function varValue(name: string, fallback: string): string {
  return `var(${name}, ${fallback})`;
}
