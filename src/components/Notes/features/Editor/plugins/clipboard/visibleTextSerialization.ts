import type { Slice } from '@milkdown/kit/prose/model';

function getNodeChildren(node: any): any[] {
  const children: any[] = [];
  node?.content?.forEach?.((child: any) => {
    children.push(child);
  });
  return children;
}

export function isVisiblePlainTextNode(node: any): boolean {
  if (!node) return true;
  if (node.isText) return true;
  if (node.type?.name === 'hard_break') return true;
  if (!node.isTextblock && !['paragraph', 'heading', 'code_block'].includes(node.type?.name)) return false;

  return getNodeChildren(node).every(isVisiblePlainTextNode);
}

function serializeVisiblePlainTextNode(node: any): string {
  if (!node) return '';
  if (node.isText) return node.text ?? '';
  if (node.type?.name === 'hard_break') return '\n';

  return getNodeChildren(node).map(serializeVisiblePlainTextNode).join('');
}

export function serializeSliceAsVisiblePlainText(slice: Pick<Slice, 'content'>): string {
  return getNodeChildren({ content: slice.content })
    .map(serializeVisiblePlainTextNode)
    .join('\n')
    .replace(/\n+$/, '');
}

export function isVisiblePlainTextSlice(slice: Pick<Slice, 'content'>): boolean {
  return getNodeChildren({ content: slice.content }).every(isVisiblePlainTextNode);
}
