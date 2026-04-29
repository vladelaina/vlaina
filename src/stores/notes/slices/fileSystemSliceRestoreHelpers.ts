import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { buildFileTree } from '../fileTreeUtils';
import { createEmptyMetadataFile, remapMetadataEntries } from '../storage';
import {
  getStarredEntryKey,
  getVaultStarredPaths,
} from '../starred';
import type { FileTreeNode, MetadataFile, StarredEntry } from '../types';

export function getParentPath(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function getBaseName(path: string): string {
  return path.split('/').pop() || path;
}

function isDeletedPath(path: string, deletedPath: string, kind: 'file' | 'folder'): boolean {
  return kind === 'folder'
    ? path === deletedPath || path.startsWith(`${deletedPath}/`)
    : path === deletedPath;
}

function remapRestoredPath(path: string, originalPath: string, restoredPath: string): string {
  return path === originalPath ? restoredPath : `${restoredPath}${path.slice(originalPath.length)}`;
}

export function collectDeletedStarredEntries(
  entries: StarredEntry[],
  deletedPath: string,
  kind: 'file' | 'folder',
): StarredEntry[] {
  return entries.filter((entry) => isDeletedPath(entry.relativePath, deletedPath, kind));
}

export function collectDeletedMetadata(
  metadata: MetadataFile | null,
  deletedPath: string,
  kind: 'file' | 'folder',
): MetadataFile | null {
  if (!metadata) {
    return null;
  }

  const notes = Object.fromEntries(
    Object.entries(metadata.notes).filter(([path]) => isDeletedPath(path, deletedPath, kind)),
  );

  return {
    ...metadata,
    notes,
  };
}

export function restoreDeletedStarredEntries({
  currentEntries,
  deletedEntries,
  notesPath,
  originalPath,
  restoredPath,
}: {
  currentEntries: StarredEntry[];
  deletedEntries: StarredEntry[];
  notesPath: string;
  originalPath: string;
  restoredPath: string;
}) {
  if (deletedEntries.length === 0) {
    const starredPaths = getVaultStarredPaths(currentEntries, notesPath);
    return {
      entries: currentEntries,
      notes: starredPaths.notes,
      folders: starredPaths.folders,
      changed: false,
    };
  }

  const existingKeys = new Set(currentEntries.map((entry) => getStarredEntryKey(entry)));
  const restoredEntries = deletedEntries
    .map((entry) => ({
      ...entry,
      relativePath: remapRestoredPath(entry.relativePath, originalPath, restoredPath),
    }))
    .filter((entry) => !existingKeys.has(getStarredEntryKey(entry)));
  const entries = [...currentEntries, ...restoredEntries];
  const starredPaths = getVaultStarredPaths(entries, notesPath);

  return {
    entries,
    notes: starredPaths.notes,
    folders: starredPaths.folders,
    changed: restoredEntries.length > 0,
  };
}

export function restoreDeletedMetadata({
  currentMetadata,
  deletedMetadata,
  originalPath,
  restoredPath,
}: {
  currentMetadata: MetadataFile | null;
  deletedMetadata: MetadataFile | null;
  originalPath: string;
  restoredPath: string;
}): MetadataFile | null {
  if (!deletedMetadata || Object.keys(deletedMetadata.notes).length === 0) {
    return currentMetadata;
  }

  const remappedDeletedMetadata = remapMetadataEntries(deletedMetadata, (path) =>
    remapRestoredPath(path, originalPath, restoredPath),
  );

  return {
    ...(currentMetadata ?? createEmptyMetadataFile()),
    notes: {
      ...(currentMetadata?.notes ?? {}),
      ...(remappedDeletedMetadata?.notes ?? {}),
    },
  };
}

export async function createRestoredTreeNode(
  notesPath: string,
  restoredPath: string,
  kind: 'file' | 'folder',
): Promise<FileTreeNode> {
  if (kind === 'folder') {
    let children: FileTreeNode[] = [];
    try {
      children = await buildFileTree(notesPath, restoredPath);
    } catch {
    }

    return {
      id: restoredPath,
      name: getBaseName(restoredPath),
      path: restoredPath,
      isFolder: true,
      expanded: true,
      children,
    };
  }

  return {
    id: restoredPath,
    name: getNoteTitleFromPath(getBaseName(restoredPath)),
    path: restoredPath,
    isFolder: false,
  };
}
