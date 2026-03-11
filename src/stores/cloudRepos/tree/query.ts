import type { CloudRepoNode } from '../types';

export function findNode(nodes: CloudRepoNode[], targetPath: string): CloudRepoNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.kind === 'folder' && node.children) {
      const child = findNode(node.children, targetPath);
      if (child) return child;
    }
  }
  return null;
}
