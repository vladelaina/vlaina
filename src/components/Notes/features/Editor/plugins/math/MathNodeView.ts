import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { renderMathEditorLivePreview } from './mathEditorLivePreview';
import { createMathNodeDOM } from './mathSchema';

export class MathNodeView implements NodeView {
  dom: HTMLElement;
  private node: Node;

  constructor(node: Node, _view: EditorView, _getPos: () => number | undefined) {
    this.node = node;
    this.dom = this.createDom(node);
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
    const latex = String(node.attrs.latex || '');
    const displayMode = node.type.name === 'math_block';

    if (this.dom.dataset.latex !== latex) {
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
}
