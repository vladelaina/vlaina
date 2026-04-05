import { useFileTreePointerDragState } from './fileTreePointerDragState';

export function useFolderDropTarget(path: string, enabled = true) {
  return {
    isDragOver: useFileTreePointerDragState((state) => enabled && state.dropTargetPath === path),
  };
}
