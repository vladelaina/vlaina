import { isInvalidMoveTarget } from '@/stores/notes/utils/fs/moveValidation';
import { logNotesDebug } from '@/stores/notes/debugLog';

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

export function resolveStarredDropTargetFromElements(elements: Element[]) {
  return elements.some((element) => (
    element instanceof HTMLElement &&
    element.closest('[data-file-tree-starred-drop-target="true"]')
  ));
}

export function resolveExternalFolderDropTargetPath(clientX: number, clientY: number) {
  const elements = document.elementsFromPoint(clientX, clientY);
  const targetPath = resolveFolderDropTargetPathFromElements(elements);

  logNotesDebug('dropTargetDom:resolveExternalFolderDropTargetPath', {
    x: clientX,
    y: clientY,
    targetPath,
    elements: elements.slice(0, 8).map((element) => {
      if (!(element instanceof HTMLElement)) {
        return {
          tagName: element.tagName,
        };
      }

      return {
        tagName: element.tagName,
        className: element.className,
        fileTreeKind: element.dataset.fileTreeKind ?? null,
        fileTreePath: element.dataset.fileTreePath ?? null,
        rootDropTarget: element.dataset.fileTreeRootDropTarget ?? null,
      };
    }),
  });

  return targetPath;
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
