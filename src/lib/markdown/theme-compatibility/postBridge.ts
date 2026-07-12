import { buildTyporaPostBridgeCss } from './typora/postBridge';
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
