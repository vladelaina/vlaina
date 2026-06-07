import {
  getTyporaRootSelector,
  getTyporaWriteSelector,
} from './shared';
import {
  buildTyporaCaptionBridge,
  buildTyporaMediaBridge,
  buildTyporaTableBridge,
} from './typoraContentBridge';
import {
  buildTyporaRootBridge,
  buildTyporaWriteBridge,
} from './typoraCoreBridge';
import {
  buildTyporaCardBridge,
  buildTyporaImageBridge,
} from './typoraImageBridge';
import {
  buildTyporaCheckboxBridge,
  buildTyporaColumnBridge,
} from './typoraSemanticBridge';

export function buildTyporaPostBridgeCss(importedThemeId: string): string {
  const root = getTyporaRootSelector(importedThemeId);
  const write = getTyporaWriteSelector(importedThemeId);

  return [
    ...buildTyporaRootBridge(root),
    ...buildTyporaWriteBridge(write),
    ...buildTyporaMediaBridge(write),
    ...buildTyporaTableBridge(write),
    ...buildTyporaCaptionBridge(write),
    ...buildTyporaImageBridge(write),
    ...buildTyporaCardBridge(write),
    ...buildTyporaColumnBridge(write),
    ...buildTyporaCheckboxBridge(write),
  ].join('\n').trimEnd();
}
