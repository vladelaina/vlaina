import { isInvalidMoveTarget } from '@/stores/notes/utils/fs/moveValidation';

function resolveFolderDropTargetPathFromElements(elements: Element[]) {
  for (const element of elements) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const rootDropTarget = element.closest<HTMLElement>('[data-file-tree-root-drop-target="true"]');
    if (rootDropTarget) {
      return '';
    }

    const folderElement = element.closest<HTMLElement>('[data-file-tree-kind="folder"]');
    const targetPath = folderElement?.dataset.fileTreePath;
    if (targetPath) {
      return targetPath;
    }
  }

  return null;
}

export function resolveExternalFolderDropTargetPath(clientX: number, clientY: number) {
  return resolveFolderDropTargetPathFromElements(document.elementsFromPoint(clientX, clientY));
}

export function resolveInternalMoveDropTargetPath(
  clientX: number,
  clientY: number,
  sourcePath: string,
) {
  const targetPath = resolveFolderDropTargetPathFromElements(document.elementsFromPoint(clientX, clientY));
  if (targetPath == null || isInvalidMoveTarget(sourcePath, targetPath)) {
    return null;
  }
  return targetPath;
}
