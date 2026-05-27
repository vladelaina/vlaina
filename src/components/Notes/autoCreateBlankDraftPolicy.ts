import type { FolderNode } from '@/stores/notes/types';

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
  | 'vault-has-entries';

export interface AutoCreateBlankDraftPolicyResult {
  shouldCreate: boolean;
  blockedReasons: AutoCreateBlankDraftBlockReason[];
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
  if (rootFolderCurrent && input.rootFolder && input.rootFolder.children.length > 0) {
    blockedReasons.push('vault-has-entries');
  }

  return {
    shouldCreate: blockedReasons.length === 0,
    blockedReasons,
  };
}
