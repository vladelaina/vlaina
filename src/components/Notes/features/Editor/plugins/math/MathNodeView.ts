import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { attachPreviewContextMenu, type PreviewContextMenuSession } from '../shared/previewContextMenu';
import { renderMathEditorLivePreview } from './mathEditorLivePreview';
import { createMathNodeDOM, getMathElementLatex } from './mathSchema';

export class MathNodeView implements NodeView {
  dom: HTMLElement;
  private node: Node;
  private contextMenu: PreviewContextMenuSession;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.dom = this.createDom(node);
    this.contextMenu = attachPreviewContextMenu({
      element: this.dom,
      fileBaseName: 'math-formula',
      getPos,
      node,
      view,
    });
  }

  private createDom(node: Node) {
    const displayMode = node.type.name === 'math_block';
    return createMathNodeDOM({
      tagName: displayMode ? 'div' : 'span',
      dataType: displayMode ? 'math-block' : 'math-inline',
      className: displayMode ? 'math-block-wrapper' : 'math-inline-wrapper',
      latex: String(node.attrs.latex || ''),
      displayMode,
    }) as HTMLElement;
  }

  update(node: Node) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    this.contextMenu.updateNode(node);
    const latex = String(node.attrs.latex || '');
    const displayMode = node.type.name === 'math_block';

    if (getMathElementLatex(this.dom) !== latex) {
      renderMathEditorLivePreview({
        anchor: this.dom,
        latex,
        displayMode,
      });
    }

    return true;
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    this.contextMenu.destroy();
  }
}
