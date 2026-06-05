const MAX_CHAT_STREAM_HAST_DEPTH = 200;
const MAX_CHAT_STREAM_HAST_NODES = 20_000;

export function getChatStreamHastChildren(node: any): any[] {
  return Array.isArray(node?.children) ? node.children : [];
}

export function canTransformChatStreamHast(tree: any): boolean {
  const stack = [{ depth: 0, node: tree }];
  let nodes = 0;

  while (stack.length > 0) {
    const { depth, node } = stack.pop()!;
    nodes += 1;
    if (nodes > MAX_CHAT_STREAM_HAST_NODES || depth > MAX_CHAT_STREAM_HAST_DEPTH) {
      return false;
    }

    const children = getChatStreamHastChildren(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ depth: depth + 1, node: children[index] });
    }
  }

  return true;
}

export function getChatStreamTimingTextLength(node: any): number {
  let length = 0;
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.tagName === 'img' && typeof current.properties?.alt === 'string') {
      length += Array.from(current.properties.alt).length;
      continue;
    }

    const children = getChatStreamHastChildren(current);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child.type === 'text' && typeof child.value === 'string') {
        length += Array.from(child.value).length;
      } else if (child.type === 'element') {
        stack.push(child);
      }
    }
  }

  return length;
}
