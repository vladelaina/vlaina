import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { createMermaidElement, getMermaidElementCode, renderMermaidEditorLivePreview } from './mermaidDom';
import { normalizeMermaidEditorCodeInput } from './mermaidFenceCode';

export function shouldRefreshMermaidElementCode(element: HTMLElement, code: string) {
  return getMermaidElementCode(element) !== normalizeMermaidEditorCodeInput(code);
}

export class MermaidNodeView implements NodeView {
  dom: HTMLElement;
  private node: Node;

  constructor(node: Node, _view: EditorView, _getPos: () => number | undefined) {
    this.node = node;
    this.dom = createMermaidElement(String(node.attrs.code || ''));
  }

  update(node: Node) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    const code = String(node.attrs.code || '');
    if (shouldRefreshMermaidElementCode(this.dom, code)) {
      void renderMermaidEditorLivePreview({
        anchor: this.dom,
        code,
      });
    }

    return true;
  }

  ignoreMutation() {
    return true;
  }
}
