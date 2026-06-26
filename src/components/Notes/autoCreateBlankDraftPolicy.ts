import type { FolderNode } from '@/stores/notes/types';

const MAX_AUTO_CREATE_FILE_TREE_SCAN_NODES = 20_000;

export interface AutoCreateBlankDraftPolicyInput {
  active: boolean;
  currentNotePath?: string | null;
  openTabCount: number;
  hasPresentedNote: boolean;
  notesLoading: boolean;
  vaultStoreHasInitialized: boolean;
  vaultInitializing: boolean;
  openTargetBusy: boolean;
  hasPendingStarredNavigation: boolean;
  autoCreateInFlight: boolean;
  hasPendingLaunchNote: boolean;
  currentVaultPath?: string | null;
  notesPath: string;
  rootFolder: FolderNode | null;
  rootFolderPath: string | null;
}

export type AutoCreateBlankDraftBlockReason =
  | 'inactive'
  | 'has-current-note'
  | 'has-open-tabs'
  | 'already-presented-note'
  | 'notes-loading'
  | 'vault-store-initializing'
  | 'vault-initializing'
  | 'open-target-busy'
  | 'pending-starred-navigation'
  | 'auto-create-in-flight'
  | 'pending-launch-note'
  | 'vault-path-mismatch'
  | 'vault-root-not-loaded'
  | 'vault-tree-scan-budget'
  | 'vault-has-files';

export interface AutoCreateBlankDraftPolicyResult {
  shouldCreate: boolean;
  blockedReasons: AutoCreateBlankDraftBlockReason[];
}

function scanFileTreeForNoteFiles(rootFolder: FolderNode | null): {
  hasFiles: boolean;
  exhaustedBudget: boolean;
} {
  if (!rootFolder) {
    return { hasFiles: false, exhaustedBudget: false };
  }

  const stack = [...rootFolder.children];
  let visitedNodes = 0;
  while (stack.length > 0 && visitedNodes < MAX_AUTO_CREATE_FILE_TREE_SCAN_NODES) {
    const node = stack.pop()!;
    visitedNodes += 1;
    if (!node.isFolder) {
      return { hasFiles: true, exhaustedBudget: false };
    }
    stack.push(...node.children);
  }

  return { hasFiles: false, exhaustedBudget: stack.length > 0 };
}

export function hasFileTreeNoteFiles(rootFolder: FolderNode | null): boolean {
  return scanFileTreeForNoteFiles(rootFolder).hasFiles;
}

export function shouldAutoCreateBlankDraft(
  input: AutoCreateBlankDraftPolicyInput,
): AutoCreateBlankDraftPolicyResult {
  const blockedReasons: AutoCreateBlankDraftBlockReason[] = [];
  const currentVaultPath = input.currentVaultPath ?? null;
  const rootFolderCurrent = Boolean(
    currentVaultPath &&
    input.rootFolder &&
    input.rootFolderPath === currentVaultPath &&
    input.notesPath === currentVaultPath,
  );

  if (!input.active) blockedReasons.push('inactive');
  if (input.currentNotePath) blockedReasons.push('has-current-note');
  if (input.openTabCount > 0) blockedReasons.push('has-open-tabs');
  if (input.hasPresentedNote) blockedReasons.push('already-presented-note');
  if (input.notesLoading) blockedReasons.push('notes-loading');
  if (!input.vaultStoreHasInitialized) blockedReasons.push('vault-store-initializing');
  if (input.vaultInitializing) blockedReasons.push('vault-initializing');
  if (input.openTargetBusy) blockedReasons.push('open-target-busy');
  if (input.hasPendingStarredNavigation) blockedReasons.push('pending-starred-navigation');
  if (input.autoCreateInFlight) blockedReasons.push('auto-create-in-flight');
  if (input.hasPendingLaunchNote) blockedReasons.push('pending-launch-note');
  if (currentVaultPath && input.notesPath !== currentVaultPath) blockedReasons.push('vault-path-mismatch');
  if (currentVaultPath && !rootFolderCurrent) blockedReasons.push('vault-root-not-loaded');
  if (rootFolderCurrent) {
    const fileTreeScan = scanFileTreeForNoteFiles(input.rootFolder);
    if (fileTreeScan.hasFiles) {
      blockedReasons.push('vault-has-files');
    }
    if (fileTreeScan.exhaustedBudget) {
      blockedReasons.push('vault-tree-scan-budget');
    }
  }

  return {
    shouldCreate: blockedReasons.length === 0,
    blockedReasons,
  };
}
