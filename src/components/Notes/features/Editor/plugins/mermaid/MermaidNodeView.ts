import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { attachPreviewContextMenu, type PreviewContextMenuSession } from '../shared/previewContextMenu';
import {
  createMermaidElement,
  disposeMermaidElement,
  getMermaidElementCode,
  renderMermaidEditorLivePreview,
} from './mermaidDom';
import { normalizeMermaidEditorCodeInput } from './mermaidFenceCode';

export function shouldRefreshMermaidElementCode(element: HTMLElement, code: string) {
  return getMermaidElementCode(element) !== normalizeMermaidEditorCodeInput(code);
}

function getMermaidNodeCode(node: Node): string {
  return typeof node.attrs.code === 'string' ? node.attrs.code : '';
}

export class MermaidNodeView implements NodeView {
  dom: HTMLElement;
  private node: Node;
  private contextMenu: PreviewContextMenuSession;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    const code = getMermaidNodeCode(node);
    this.dom = createMermaidElement(code);
    this.contextMenu = attachPreviewContextMenu({
      element: this.dom,
      fileBaseName: 'mermaid-diagram',
      getPos,
      node,
      view,
    });
  }

  update(node: Node) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    this.contextMenu.updateNode(node);
    const code = getMermaidNodeCode(node);
    if (shouldRefreshMermaidElementCode(this.dom, code)) {
      void renderMermaidEditorLivePreview({
        anchor: this.dom,
        code,
      }).catch(() => undefined);
    }

    return true;
  }

  ignoreMutation() {
    return true;
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode', 'md-focus');
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode', 'md-focus');
  }

  destroy() {
    disposeMermaidElement(this.dom);
    this.contextMenu.destroy();
  }
}
