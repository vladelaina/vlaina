import type { TreeEntry } from '@/lib/tauri/githubRepoCommands';
import type { CloudRepoDraftRecord, CloudRepoNode, CloudRepoNodeKind } from './types';

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith('.md');
}

function isPlaceholderPath(path: string): boolean {
  return path.endsWith('.nekotick.keep');
}

function sortNodes(nodes: CloudRepoNode[]): CloudRepoNode[] {
  nodes.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'folder' ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

  for (const node of nodes) {
    if (node.children) {
      sortNodes(node.children);
    }
  }

  return nodes;
}

function cloneNode(node: CloudRepoNode): CloudRepoNode {
  return {
    ...node,
    children: node.children ? node.children.map(cloneNode) : undefined,
  };
}

function createFolderNode(path: string, expanded = false): CloudRepoNode {
  return {
    path,
    name: path.split('/').pop() ?? path,
    kind: 'folder',
    sha: null,
    expanded,
    children: [],
  };
}

function createFileNode(path: string, sha: string | null): CloudRepoNode {
  return {
    path,
    name: path.split('/').pop() ?? path,
    kind: 'file',
    sha,
    expanded: false,
  };
}

function collectExpandedState(
  nodes: CloudRepoNode[],
  expanded = new Map<string, boolean>()
): Map<string, boolean> {
  for (const node of nodes) {
    if (node.kind === 'folder') {
      expanded.set(node.path, node.expanded === true);
      collectExpandedState(node.children ?? [], expanded);
    }
  }
  return expanded;
}

function ensureFolder(
  nodes: CloudRepoNode[],
  folderPath: string,
  expandedLookup: Map<string, boolean>,
  forceExpanded: boolean
): CloudRepoNode {
  const segments = folderPath.split('/');
  let currentNodes = nodes;
  let currentPath = '';
  let folder: CloudRepoNode | null = null;

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    let next = currentNodes.find(
      (node) => node.kind === 'folder' && node.path === currentPath
    );

    if (!next) {
      next = createFolderNode(
        currentPath,
        forceExpanded || expandedLookup.get(currentPath) === true
      );
      currentNodes.push(next);
    } else if (forceExpanded) {
      next.expanded = true;
    }

    if (!next.children) {
      next.children = [];
    }
    folder = next;
    currentNodes = next.children;
  }

  return folder ?? createFolderNode(folderPath);
}

function findNodeInternal(nodes: CloudRepoNode[], targetPath: string): CloudRepoNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node;
    }
    if (node.children) {
      const child = findNodeInternal(node.children, targetPath);
      if (child) return child;
    }
  }
  return null;
}

export function findNode(nodes: CloudRepoNode[], targetPath: string): CloudRepoNode | null {
  return findNodeInternal(nodes, targetPath);
}

export function buildTreeFromRecursiveEntries(
  entries: TreeEntry[],
  previousNodes: CloudRepoNode[] = []
): CloudRepoNode[] {
  const root: CloudRepoNode[] = [];
  const expandedLookup = collectExpandedState(previousNodes.map(cloneNode));

  for (const entry of entries) {
    if (entry.entryType === 'dir') {
      ensureFolder(root, entry.path, expandedLookup, false);
      continue;
    }

    if (!isMarkdownPath(entry.path) || isPlaceholderPath(entry.path)) {
      continue;
    }

    const parentPath = entry.path.includes('/')
      ? entry.path.slice(0, entry.path.lastIndexOf('/'))
      : '';
    const container = parentPath
      ? ensureFolder(root, parentPath, expandedLookup, false).children ?? []
      : root;
    const existing = container.find((node) => node.path === entry.path);
    if (existing) {
      existing.sha = entry.sha ?? null;
      continue;
    }
    container.push(createFileNode(entry.path, entry.sha ?? null));
  }

  return sortNodes(root);
}

export function upsertTreeNode(
  nodes: CloudRepoNode[],
  path: string,
  kind: CloudRepoNodeKind,
  sha: string | null = null
): CloudRepoNode[] {
  const next = nodes.map(cloneNode);
  const expandedLookup = collectExpandedState(next);
  const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const container = parentPath
    ? ensureFolder(next, parentPath, expandedLookup, true).children ?? []
    : next;
  const existing = container.find((node) => node.path === path);

  if (existing) {
    existing.kind = kind;
    existing.sha = sha;
    existing.name = path.split('/').pop() ?? path;
    if (kind === 'folder') {
      existing.children = existing.children ?? [];
      existing.expanded = true;
    }
    return sortNodes(next);
  }

  container.push(
    kind === 'folder' ? createFolderNode(path, true) : createFileNode(path, sha)
  );
  return sortNodes(next);
}

export function applyDraftNodes(
  nodes: CloudRepoNode[],
  drafts: Iterable<CloudRepoDraftRecord>
): CloudRepoNode[] {
  let next = nodes.map(cloneNode);

  for (const draft of drafts) {
    if (draft.state === 'conflict') continue;
    if (!isMarkdownPath(draft.relativePath) || isPlaceholderPath(draft.relativePath)) continue;
    next = upsertTreeNode(next, draft.relativePath, 'file', draft.previousSha);
  }

  return next;
}

export function toggleNodeExpanded(
  nodes: CloudRepoNode[],
  targetPath: string
): CloudRepoNode[] {
  return nodes.map((node) => {
    if (node.kind !== 'folder') {
      return cloneNode(node);
    }

    const nextNode = cloneNode(node);
    if (nextNode.path === targetPath) {
      nextNode.expanded = !nextNode.expanded;
      return nextNode;
    }

    if (nextNode.children) {
      nextNode.children = toggleNodeExpanded(nextNode.children, targetPath);
    }
    return nextNode;
  });
}
