import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { MAX_RECENT_NOTES } from './constants';
import { isDraftNotePath } from './draftNote';
import type { FileTreeSortMode } from './types';
import type { WorkspaceState } from './storage';
import { normalizeVaultRelativePath } from './utils/fs/vaultPathContainment';

const MAX_WORKSPACE_EXPANDED_FOLDERS = 5000;
const FILE_TREE_SORT_MODES = new Set<FileTreeSortMode>([
  'name-asc',
  'name-desc',
  'updated-desc',
  'created-desc',
]);

function normalizeRecentNotePath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedPath = normalizeVaultRelativePath(value);
  if (!normalizedPath || isDraftNotePath(normalizedPath) || !isSupportedMarkdownPath(normalizedPath)) {
    return null;
  }

  return normalizedPath;
}

export function normalizeRecentNotePaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalizedPaths: string[] = [];

  for (const item of value) {
    const normalizedPath = normalizeRecentNotePath(item);
    if (!normalizedPath || seen.has(normalizedPath)) {
      continue;
    }

    seen.add(normalizedPath);
    normalizedPaths.push(normalizedPath);
    if (normalizedPaths.length >= MAX_RECENT_NOTES) {
      break;
    }
  }

  return normalizedPaths;
}

function normalizeWorkspaceCurrentNote(value: unknown): string | null {
  const normalizedPath = normalizeRecentNotePath(value);
  return normalizedPath ?? null;
}

function normalizeExpandedFolders(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalizedPaths: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const normalizedPath = normalizeVaultRelativePath(item);
    if (!normalizedPath || seen.has(normalizedPath)) {
      continue;
    }

    seen.add(normalizedPath);
    normalizedPaths.push(normalizedPath);
    if (normalizedPaths.length >= MAX_WORKSPACE_EXPANDED_FOLDERS) {
      break;
    }
  }

  return normalizedPaths;
}

function normalizeFileTreeSortMode(value: unknown): FileTreeSortMode | undefined {
  return typeof value === 'string' && FILE_TREE_SORT_MODES.has(value as FileTreeSortMode)
    ? value as FileTreeSortMode
    : undefined;
}

export function normalizeWorkspaceState(value: unknown): WorkspaceState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return {
    currentNotePath: normalizeWorkspaceCurrentNote(candidate.currentNotePath),
    expandedFolders: normalizeExpandedFolders(candidate.expandedFolders),
    fileTreeSortMode: normalizeFileTreeSortMode(candidate.fileTreeSortMode),
  };
}
