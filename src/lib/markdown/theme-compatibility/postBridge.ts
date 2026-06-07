import { buildTyporaPostBridgeCss } from './postBridge/typoraBridge';
import type { MarkdownThemePlatform } from './types';

export function buildImportedMarkdownThemePostBridgeCss(
  importedThemeId: string,
  platform: MarkdownThemePlatform
): string {
  if (platform !== 'typora') {
    return '';
  }

  return buildTyporaPostBridgeCss(importedThemeId);
}
