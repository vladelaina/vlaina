import type { FileTreeNode, FileTreeSortMode, MetadataFile } from './types';

export const DEFAULT_FILE_TREE_SORT_MODE: FileTreeSortMode = 'name-asc';

export const FILE_TREE_SORT_OPTIONS: Array<{ value: FileTreeSortMode; label: string }> = [
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'updated-desc', label: 'Recently Updated' },
  { value: 'created-desc', label: 'Recently Created' },
];

interface FileTreeSortContext {
  mode?: FileTreeSortMode;
  metadata?: MetadataFile | null;
}

function compareByName(left: FileTreeNode, right: FileTreeNode, direction: 1 | -1 = 1) {
  const nameResult =
    left.name.toLowerCase().localeCompare(right.name.toLowerCase()) * direction;
  if (nameResult !== 0) {
    return nameResult;
  }
  return left.path.toLowerCase().localeCompare(right.path.toLowerCase()) * direction;
}

function getNodeTimestamp(
  node: FileTreeNode,
  metadata: MetadataFile | null | undefined,
  key: 'createdAt' | 'updatedAt'
) {
  if (node.isFolder) {
    return 0;
  }
  return metadata?.notes[node.path]?.[key] ?? 0;
}

export function getFileTreeSortLabel(mode: FileTreeSortMode) {
  return FILE_TREE_SORT_OPTIONS.find((option) => option.value === mode)?.label ?? 'Name A-Z';
}

export function sortFileTree(
  nodes: FileTreeNode[],
  { mode = DEFAULT_FILE_TREE_SORT_MODE, metadata = null }: FileTreeSortContext = {}
): FileTreeNode[] {
  return [...nodes].sort((left, right) => {
    if (left.isFolder && !right.isFolder) return -1;
    if (!left.isFolder && right.isFolder) return 1;

    if (mode === 'name-asc') {
      return compareByName(left, right, 1);
    }

    if (mode === 'name-desc') {
      return compareByName(left, right, -1);
    }

    if (left.isFolder && right.isFolder) {
      return compareByName(left, right, 1);
    }

    const timestampKey = mode === 'created-desc' ? 'createdAt' : 'updatedAt';
    const leftTimestamp = getNodeTimestamp(left, metadata, timestampKey);
    const rightTimestamp = getNodeTimestamp(right, metadata, timestampKey);

    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return compareByName(left, right, 1);
  });
}

export function sortNestedFileTree(
  nodes: FileTreeNode[],
  context: FileTreeSortContext = {}
): FileTreeNode[] {
  const nextNodes = nodes.map((node) =>
    node.isFolder
      ? {
          ...node,
          children: sortNestedFileTree(node.children, context),
        }
      : node
  );

  return sortFileTree(nextNodes, context);
}
