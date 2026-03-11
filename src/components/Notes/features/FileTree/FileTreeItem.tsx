import type { FileTreeNode } from '@/stores/useNotesStore';
import { FileItem } from './FileItem';
import { FolderItem } from './FolderItem';

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  currentNotePath?: string;
}

export function FileTreeItem({ node, depth, currentNotePath }: FileTreeItemProps) {
  if (node.isFolder) {
    return <FolderItem node={node} depth={depth} currentNotePath={currentNotePath} />;
  }

  return <FileItem node={node} depth={depth} currentNotePath={currentNotePath} />;
}
