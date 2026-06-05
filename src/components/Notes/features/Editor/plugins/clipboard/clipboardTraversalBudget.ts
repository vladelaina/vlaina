export const MAX_CLIPBOARD_SERIALIZATION_DEPTH = 200;
export const MAX_CLIPBOARD_SERIALIZATION_NODES = 20_000;

export interface ClipboardTraversalBudget {
  nodes: number;
  exceeded: boolean;
}

export function createClipboardTraversalBudget(): ClipboardTraversalBudget {
  return {
    nodes: 0,
    exceeded: false,
  };
}

export function consumeClipboardTraversalNode(
  budget: ClipboardTraversalBudget,
  depth: number
): boolean {
  budget.nodes += 1;
  if (
    budget.nodes > MAX_CLIPBOARD_SERIALIZATION_NODES ||
    depth > MAX_CLIPBOARD_SERIALIZATION_DEPTH
  ) {
    budget.exceeded = true;
    return false;
  }
  return true;
}

export function getProseNodeChildren(node: any): any[] {
  const children: any[] = [];
  node?.content?.forEach?.((child: any) => {
    children.push(child);
  });
  return children;
}
