import type { NotesOutlineHeading } from './types';

export interface OutlineTreeNode extends NotesOutlineHeading {
  children: OutlineTreeNode[];
}

export function buildOutlineTree(headings: readonly NotesOutlineHeading[]): OutlineTreeNode[] {
  const roots: OutlineTreeNode[] = [];
  const stack: OutlineTreeNode[] = [];

  for (const heading of headings) {
    const node: OutlineTreeNode = { ...heading, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    stack.push(node);
  }

  return roots;
}

export function cleanupCollapsedHeadingIds(
  collapsedHeadingIds: ReadonlySet<string>,
  headings: readonly NotesOutlineHeading[],
): Set<string> {
  const validIds = new Set(headings.map((heading) => heading.id));
  const next = new Set<string>();
  collapsedHeadingIds.forEach((id) => {
    if (validIds.has(id)) {
      next.add(id);
    }
  });
  return next;
}

export function toggleCollapsedHeadingId(
  collapsedHeadingIds: ReadonlySet<string>,
  headingId: string,
): Set<string> {
  const next = new Set(collapsedHeadingIds);
  if (next.has(headingId)) {
    next.delete(headingId);
  } else {
    next.add(headingId);
  }
  return next;
}
