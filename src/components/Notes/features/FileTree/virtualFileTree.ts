import type { FileTreeNode } from '@/stores/useNotesStore';

export interface VirtualFileTreeRow {
  node: FileTreeNode;
  depth: number;
  parentFolderPath: string;
}

export const VIRTUAL_FILE_TREE_ROW_HEIGHT = 38;
export const VIRTUAL_FILE_TREE_OVERSCAN_ROWS = 10;
export const VIRTUAL_FILE_TREE_MIN_ROWS = 180;

export function flattenVisibleFileTreeRows(
  nodes: FileTreeNode[],
  startDepth = 0,
  parentFolderPath = '',
): VirtualFileTreeRow[] {
  const rows: VirtualFileTreeRow[] = [];

  function visit(children: FileTreeNode[], depth: number, parentPath: string) {
    for (const node of children) {
      rows.push({
        node,
        depth,
        parentFolderPath: parentPath,
      });

      if (node.isFolder && node.expanded && node.children.length > 0) {
        visit(node.children, depth + 1, node.path);
      }
    }
  }

  visit(nodes, startDepth, parentFolderPath);
  return rows;
}

export function countVisibleFileTreeRows(nodes: FileTreeNode[]): number {
  let count = 0;

  function visit(children: FileTreeNode[]) {
    for (const node of children) {
      count += 1;

      if (node.isFolder && node.expanded && node.children.length > 0) {
        visit(node.children);
      }
    }
  }

  visit(nodes);
  return count;
}

export function getVirtualFileTreeWindow(input: {
  rowCount: number;
  rowHeight: number;
  viewportStart: number;
  viewportHeight: number;
  overscanRows: number;
}) {
  const normalizedViewportStart = Math.max(0, input.viewportStart);
  const visibleStartIndex = Math.floor(normalizedViewportStart / input.rowHeight);
  const visibleEndIndex = Math.ceil(
    (normalizedViewportStart + input.viewportHeight) / input.rowHeight,
  );
  const startIndex = Math.max(0, visibleStartIndex - input.overscanRows);
  const endIndex = Math.min(input.rowCount, visibleEndIndex + input.overscanRows);

  return {
    startIndex,
    endIndex,
    offsetTop: startIndex * input.rowHeight,
    totalHeight: input.rowCount * input.rowHeight,
  };
}
