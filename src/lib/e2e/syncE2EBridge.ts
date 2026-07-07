import { createSyncE2EChatActions } from './syncE2EChatActions';
import { createSyncE2ECoreActions } from './syncE2ECoreActions';
import { createSyncE2EEditorActions } from './syncE2EEditorActions';
import { createSyncE2ENotesActions } from './syncE2ENotesActions';
import { isE2EBridgeEnabled } from './syncE2EBridgeState';
import { createSyncE2EUIActions } from './syncE2EUIActions';
import type { E2EBridge } from './syncE2EBridgeTypes';

export type {
  E2EBridge,
  EditorDispatchProfileSummary,
  EditorSelectionSummary,
} from './syncE2EBridgeTypes';

export function installSyncE2EBridge(): void {
  if (!isE2EBridgeEnabled() || window.__vlainaE2E) {
    return;
  }

  const bridge: E2EBridge = {
    ...createSyncE2ECoreActions(),
    ...createSyncE2EChatActions(),
    ...createSyncE2ENotesActions(),
    ...createSyncE2EEditorActions(),
    ...createSyncE2EUIActions(),
  };

  window.__vlainaE2E = bridge;
}
