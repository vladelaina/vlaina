import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import {
  addNodeToTree,
  deepUpdateNodePath,
  findNode,
  removeNodeFromTree,
} from '../fileTreeUtils';
import { remapMetadataEntries } from '../storage';
import {
  getNotesRootStarredPaths,
  remapStarredEntriesForNotesRoot,
  saveStarredRegistry,
} from '../starred';
import type { FileSystemSliceGet } from './fileSystemSliceContracts';

export function isActiveNotesPath(get: FileSystemSliceGet, notesPath: string) {
  return get().notesPath === notesPath;
}

export function remapMetadataForRename(
  noteMetadata: ReturnType<FileSystemSliceGet>['noteMetadata'],
  oldPath: string,
  newPath: string,
) {
  return remapMetadataEntries(noteMetadata, (metadataPath) =>
    metadataPath === oldPath || metadataPath.startsWith(`${oldPath}/`)
      ? `${newPath}${metadataPath.slice(oldPath.length)}`
      : metadataPath
  );
}

function getRemappedStarredState(
  starredEntries: ReturnType<FileSystemSliceGet>['starredEntries'],
  notesPath: string,
  remapPath: Parameters<typeof remapStarredEntriesForNotesRoot>[2],
) {
  const starredResult = remapStarredEntriesForNotesRoot(starredEntries, notesPath, remapPath);
  if (starredResult.changed) {
    void Promise.resolve(saveStarredRegistry(starredResult.entries)).catch(() => undefined);
  }

  const starredPaths = getNotesRootStarredPaths(starredResult.entries, notesPath);
  return {
    entries: starredResult.entries,
    notes: starredPaths.notes,
    folders: starredPaths.folders,
  };
}

export function remapStarredForNoteRename(
  starredEntries: ReturnType<FileSystemSliceGet>['starredEntries'],
  notesPath: string,
  oldPath: string,
  newPath: string,
) {
  return getRemappedStarredState(starredEntries, notesPath, (relativePath, kind) => (
    kind === 'note' && relativePath === oldPath ? newPath : relativePath
  ));
}

export function remapStarredForPathRename(
  starredEntries: ReturnType<FileSystemSliceGet>['starredEntries'],
  notesPath: string,
  oldPath: string,
  newPath: string,
) {
  return getRemappedStarredState(starredEntries, notesPath, (relativePath) => {
    if (relativePath === oldPath) {
      return newPath;
    }
    if (relativePath.startsWith(`${oldPath}/`)) {
      return `${newPath}${relativePath.slice(oldPath.length)}`;
    }
    return relativePath;
  });
}

export function moveRootFolderChildren(
  children: NonNullable<ReturnType<FileSystemSliceGet>['rootFolder']>['children'],
  sourcePath: string,
  newPath: string,
  targetFolderPath: string,
) {
  const nodeToMove = findNode(children, sourcePath);
  if (!nodeToMove) {
    return children;
  }

  const nodeWithNewPath = deepUpdateNodePath(nodeToMove, sourcePath, newPath);
  const updatedNode = nodeToMove.isFolder
    ? nodeWithNewPath
    : { ...nodeWithNewPath, name: getNoteTitleFromPath(newPath) };
  return addNodeToTree(removeNodeFromTree(children, sourcePath), targetFolderPath, updatedNode);
}
