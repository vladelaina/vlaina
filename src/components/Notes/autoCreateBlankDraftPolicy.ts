import type { FolderNode } from '@/stores/notes/types';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';

const MAX_AUTO_CREATE_FILE_TREE_SCAN_NODES = 20_000;

export interface AutoCreateBlankDraftPolicyInput {
  active: boolean;
  currentNotePath?: string | null;
  openTabCount: number;
  hasPresentedNote: boolean;
  notesLoading: boolean;
  notesRootStoreHasInitialized: boolean;
  notesRootInitializing: boolean;
  openTargetBusy: boolean;
  hasPendingStarredNavigation: boolean;
  autoCreateInFlight: boolean;
  hasPendingLaunchNote: boolean;
  currentNotesRootPath?: string | null;
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
  | 'notes-root-store-initializing'
  | 'notes-root-initializing'
  | 'open-target-busy'
  | 'pending-starred-navigation'
  | 'auto-create-in-flight'
  | 'pending-launch-note'
  | 'notes-root-path-mismatch'
  | 'opened-folder-not-loaded'
  | 'notes-root-tree-scan-budget'
  | 'notes-root-has-files';

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
    if (!node.isFolder && isSupportedMarkdownPath(node.path)) {
      return { hasFiles: true, exhaustedBudget: false };
    }
    if (node.isFolder) {
      stack.push(...node.children);
    }
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
  const currentNotesRootPath = input.currentNotesRootPath ?? null;
  const rootFolderCurrent = Boolean(
    currentNotesRootPath &&
    input.rootFolder &&
    input.rootFolderPath === currentNotesRootPath &&
    input.notesPath === currentNotesRootPath,
  );

  if (!input.active) blockedReasons.push('inactive');
  if (input.currentNotePath) blockedReasons.push('has-current-note');
  if (input.openTabCount > 0) blockedReasons.push('has-open-tabs');
  if (input.hasPresentedNote) blockedReasons.push('already-presented-note');
  if (input.notesLoading) blockedReasons.push('notes-loading');
  if (!input.notesRootStoreHasInitialized) blockedReasons.push('notes-root-store-initializing');
  if (input.notesRootInitializing) blockedReasons.push('notes-root-initializing');
  if (input.openTargetBusy) blockedReasons.push('open-target-busy');
  if (input.hasPendingStarredNavigation) blockedReasons.push('pending-starred-navigation');
  if (input.autoCreateInFlight) blockedReasons.push('auto-create-in-flight');
  if (input.hasPendingLaunchNote) blockedReasons.push('pending-launch-note');
  if (currentNotesRootPath && input.notesPath !== currentNotesRootPath) blockedReasons.push('notes-root-path-mismatch');
  if (currentNotesRootPath && !rootFolderCurrent) blockedReasons.push('opened-folder-not-loaded');
  if (rootFolderCurrent) {
    const fileTreeScan = scanFileTreeForNoteFiles(input.rootFolder);
    if (fileTreeScan.hasFiles) {
      blockedReasons.push('notes-root-has-files');
    }
    if (fileTreeScan.exhaustedBudget) {
      blockedReasons.push('notes-root-tree-scan-budget');
    }
  }

  return {
    shouldCreate: blockedReasons.length === 0,
    blockedReasons,
  };
}
