import { resolveInternalMoveDropTargetPath, resolveStarredDropTargetFromElements } from './dropTargetDom';
import type { FileTreePointerDragSession, FileTreePointerDropTargetKind } from './fileTreePointerDragTypes';

interface FileTreePointerDragDropTargetResult {
  dropTargetPath: string | null;
  dropTargetKind: FileTreePointerDropTargetKind;
  pendingStarredDrop: boolean;
}

export function resolveFileTreePointerDragDropTarget(
  session: FileTreePointerDragSession,
): FileTreePointerDragDropTargetResult {
  const elements = document.elementsFromPoint(session.lastClientX, session.lastClientY);
  const isStarredDropTarget = resolveStarredDropTargetFromElements(elements);

  if (isStarredDropTarget) {
    return {
      dropTargetPath: null,
      dropTargetKind: 'starred',
      pendingStarredDrop: true,
    };
  }

  const folderDropTargetPath = resolveInternalMoveDropTargetPath(
    session.lastClientX,
    session.lastClientY,
    session.sourcePath,
  );
  return {
    dropTargetPath: folderDropTargetPath,
    dropTargetKind: folderDropTargetPath == null ? null : 'folder',
    pendingStarredDrop: false,
  };
}
