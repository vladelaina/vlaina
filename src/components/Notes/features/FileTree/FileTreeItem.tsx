import { memo } from 'react';
import type { FileTreeNode } from '@/stores/useNotesStore';
import { FileItem } from './FileItem';
import { FolderItem } from './FolderItem';

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  parentFolderPath?: string;
}

export const FileTreeItem = memo(function FileTreeItem({ node, depth, parentFolderPath = '' }: FileTreeItemProps) {
  if (node.isFolder) {
    return <FolderItem node={node} depth={depth} />;
  }

  return <FileItem node={node} depth={depth} parentFolderPath={parentFolderPath} />;
}, areFileTreeItemPropsEqual);

function areFileTreeItemPropsEqual(prevProps: FileTreeItemProps, nextProps: FileTreeItemProps) {
  return prevProps.node === nextProps.node && prevProps.depth === nextProps.depth && prevProps.parentFolderPath === nextProps.parentFolderPath;
}
