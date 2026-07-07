import type { EditorView } from '@milkdown/kit/prose/view';

export const MAX_SELECTED_CODE_BLOCK_DOM_SCAN_NODES = 20_000;

type CodeBlockScanNode = {
  attrs?: { collapsed?: boolean };
  child?: (index: number) => CodeBlockScanNode;
  childCount?: number;
  content?: { size?: number };
  nodeSize?: number;
  type: { name: string };
};

export function getSelectedCodeBlockDom(view: EditorView, from: number, to: number): HTMLElement | null {
  let codeBlockDom: HTMLElement | null = null;
  const doc = view.state.doc as unknown as CodeBlockScanNode & {
    content: { size: number };
    nodesBetween?: (
      from: number,
      to: number,
      f: (node: CodeBlockScanNode, pos: number) => boolean | void,
    ) => void;
  };

  const visitNode = (node: CodeBlockScanNode, pos: number): boolean => {
    if (node.type.name !== 'code_block') {
      return false;
    }

    const contentFrom = pos + 1;
    const contentTo = pos + (node.nodeSize ?? 1) - 1;
    if (from < contentFrom || to > contentTo || node.attrs?.collapsed) {
      return false;
    }

    const nodeDom = view.nodeDOM(pos);
    codeBlockDom = nodeDom instanceof HTMLElement ? nodeDom : null;
    return true;
  };

  if (typeof doc.child === 'function' && typeof doc.childCount === 'number') {
    let scanned = 0;
    const stack: Array<{
      childCount: number;
      contentStart: number;
      index: number;
      node: CodeBlockScanNode;
      offset: number;
    }> = [{
      childCount: doc.childCount,
      contentStart: 0,
      index: 0,
      node: doc,
      offset: 0,
    }];

    while (stack.length > 0 && scanned < MAX_SELECTED_CODE_BLOCK_DOM_SCAN_NODES) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.childCount) {
        stack.pop();
        continue;
      }

      const node = frame.node.child?.(frame.index);
      const pos = frame.contentStart + frame.offset;
      frame.index += 1;
      frame.offset += node?.nodeSize ?? 1;
      if (!node) continue;

      const nodeSize = node.nodeSize ?? 1;
      const nodeEnd = pos + nodeSize;
      if (nodeEnd < from) {
        continue;
      }
      if (pos > to) {
        break;
      }

      scanned += 1;
      if (visitNode(node, pos)) {
        break;
      }

      if (typeof node.child === 'function' && typeof node.childCount === 'number' && node.childCount > 0) {
        stack.push({
          childCount: node.childCount,
          contentStart: pos + 1,
          index: 0,
          node,
          offset: 0,
        });
      }
    }
  } else {
    let scanned = 0;
    doc.nodesBetween?.(from, to, (node, pos) => {
      scanned += 1;
      if (scanned > MAX_SELECTED_CODE_BLOCK_DOM_SCAN_NODES) {
        return;
      }
      if (visitNode(node, pos)) {
        return false;
      }
    });
  }

  return codeBlockDom;
}

export function focusSelectedCodeBlockAfterDelete(codeBlockDom: HTMLElement | null): boolean {
  if (!codeBlockDom?.isConnected) {
    return false;
  }

  const codeMirrorContent = codeBlockDom.querySelector<HTMLElement>('.cm-content');
  if (!codeMirrorContent) {
    return false;
  }

  codeMirrorContent.focus();
  return true;
}
