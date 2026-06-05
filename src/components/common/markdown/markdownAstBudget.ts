const MAX_MARKDOWN_AST_DEPTH = 200;
const MAX_MARKDOWN_AST_NODES = 20_000;

export function getMarkdownAstChildren(node: any): any[] {
  return Array.isArray(node?.children) ? node.children : [];
}

export function canTransformMarkdownAst(tree: any): boolean {
  const stack = [{ depth: 0, node: tree }];
  let nodes = 0;

  while (stack.length > 0) {
    const { depth, node } = stack.pop()!;
    nodes += 1;
    if (nodes > MAX_MARKDOWN_AST_NODES || depth > MAX_MARKDOWN_AST_DEPTH) {
      return false;
    }

    const children = getMarkdownAstChildren(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ depth: depth + 1, node: children[index] });
    }
  }

  return true;
}
