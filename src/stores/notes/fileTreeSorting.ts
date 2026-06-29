import type { FileTreeNode, FileTreeSortMode, MetadataFile } from './types';
import { translate, type MessageKey } from '@/lib/i18n';

export const DEFAULT_FILE_TREE_SORT_MODE: FileTreeSortMode = 'name-asc';

export const FILE_TREE_SORT_OPTIONS: Array<{ value: FileTreeSortMode; labelKey: MessageKey }> = [
  { value: 'name-asc', labelKey: 'sidebar.nameAsc' },
  { value: 'name-desc', labelKey: 'sidebar.nameDesc' },
  { value: 'updated-desc', labelKey: 'sidebar.recentlyUpdated' },
  { value: 'created-desc', labelKey: 'sidebar.recentlyCreated' },
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
  const labelKey = FILE_TREE_SORT_OPTIONS.find((option) => option.value === mode)?.labelKey;
  return translate(labelKey ?? 'sidebar.nameAsc');
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
  const stack: Array<{
    folder?: Extract<FileTreeNode, { isFolder: true }>;
    index: number;
    nodes: FileTreeNode[];
    output: FileTreeNode[];
  }> = [{ index: 0, nodes, output: [] }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.nodes.length) {
      const sortedNodes = sortFileTree(frame.output, context);
      stack.pop();

      if (!frame.folder) {
        return sortedNodes;
      }

      stack[stack.length - 1]?.output.push({
        ...frame.folder,
        children: sortedNodes,
      });
      continue;
    }

    const node = frame.nodes[frame.index];
    frame.index += 1;
    if (node.isFolder) {
      stack.push({ folder: node, index: 0, nodes: node.children, output: [] });
    } else {
      frame.output.push(node);
    }
  }

  return [];
}
