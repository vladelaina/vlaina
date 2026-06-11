const MAX_MARKDOWN_AST_DEPTH = 200;
export const MAX_MARKDOWN_AST_NODES = 20_000;

export interface MarkdownAstGrowthBudget {
  readonly remainingNodes: number;
  consume(additionalNodes: number): boolean;
}

export function getMarkdownAstChildren(node: any): any[] {
  return Array.isArray(node?.children) ? node.children : [];
}

export function countMarkdownAstNodes(tree: any, maxNodes = Number.MAX_SAFE_INTEGER): number {
  if (!tree) return 0;

  const stack = [tree];
  let visitedNodes = 0;

  while (stack.length > 0) {
    const node = stack.pop()!;
    visitedNodes += 1;
    if (visitedNodes > maxNodes) {
      return visitedNodes;
    }

    const children = getMarkdownAstChildren(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

  return visitedNodes;
}

export function countMarkdownAstNodeList(nodes: readonly any[], maxNodes = Number.MAX_SAFE_INTEGER): number {
  const stack = [...nodes];
  let visitedNodes = 0;

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!node) continue;

    visitedNodes += 1;
    if (visitedNodes > maxNodes) {
      return visitedNodes;
    }

    const children = getMarkdownAstChildren(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

  return visitedNodes;
}

export function createMarkdownAstGrowthBudget(tree: any): MarkdownAstGrowthBudget {
  let remainingNodes = Math.max(
    0,
    MAX_MARKDOWN_AST_NODES - countMarkdownAstNodes(tree, MAX_MARKDOWN_AST_NODES)
  );

  return {
    get remainingNodes() {
      return remainingNodes;
    },
    consume(additionalNodes: number) {
      if (additionalNodes <= 0) {
        return true;
      }
      if (additionalNodes > remainingNodes) {
        return false;
      }

      remainingNodes -= additionalNodes;
      return true;
    },
  };
}

export function canTransformMarkdownAst(tree: any): boolean {
  const stack = [{ depth: 0, node: tree }];
  let scheduledNodes = 1;
  let visitedNodes = 0;

  while (stack.length > 0) {
    const { depth, node } = stack.pop()!;
    visitedNodes += 1;
    if (visitedNodes > MAX_MARKDOWN_AST_NODES || depth > MAX_MARKDOWN_AST_DEPTH) {
      return false;
    }

    const children = getMarkdownAstChildren(node);
    scheduledNodes += children.length;
    if (scheduledNodes > MAX_MARKDOWN_AST_NODES) {
      return false;
    }

    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ depth: depth + 1, node: children[index] });
    }
  }

  return true;
}
