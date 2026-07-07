import type { NoteFile } from '@/stores/useNotesStore';

export interface FileItemProps {
  node: NoteFile;
  depth: number;
  parentFolderPath?: string;
  showStarBadge?: boolean;
  dragEnabled?: boolean;
  showMenuButton?: boolean;
}

export function areFileItemPropsEqual(prevProps: FileItemProps, nextProps: FileItemProps) {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.path === nextProps.node.path &&
    prevProps.depth === nextProps.depth &&
    prevProps.parentFolderPath === nextProps.parentFolderPath &&
    prevProps.showStarBadge === nextProps.showStarBadge &&
    prevProps.dragEnabled === nextProps.dragEnabled &&
    prevProps.showMenuButton === nextProps.showMenuButton
  );
}
