import { useFileTreePointerDragState } from './fileTreePointerDragState';
import { useExternalFileTreeDropState } from './externalFileTreeDropState';

export function useFolderDropTarget(path: string, enabled = true) {
  const isInternalDragOver = useFileTreePointerDragState(
    (state) => enabled && state.dropTargetPath === path,
  );
  const isExternalDragOver = useExternalFileTreeDropState(
    (state) => enabled && state.dropTargetPath === path,
  );

  return {
    isInternalDragOver,
    isExternalDragOver,
    isDragOver: isInternalDragOver || isExternalDragOver,
  };
}
