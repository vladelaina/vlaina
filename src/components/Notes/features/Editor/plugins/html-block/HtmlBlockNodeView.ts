import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { attachPreviewContextMenu, type PreviewContextMenuSession } from '../shared/previewContextMenu';
import {
  createHtmlBlockElement,
  getHtmlBlockNodeValue,
} from './htmlBlockEditorActions';
import { isEditableHtmlBlockValue } from './htmlBlockEditorState';
import {
  renderRawMarkdownHtmlValueIntoElement,
  sanitizeRawMarkdownHtmlValue,
} from '../../themeTextSchemaOverrides';

export class HtmlBlockNodeView implements NodeView {
  dom: HTMLElement;
  private node: ProseNode;
  private contextMenu: PreviewContextMenuSession | null = null;
  private view: EditorView;
  private getPos: () => number | undefined;

  constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.dom = createHtmlBlockElement(node);
    this.ensureContextMenu();
  }

  private ensureContextMenu() {
    if (!isEditableHtmlBlockValue(getHtmlBlockNodeValue(this.node))) {
      this.contextMenu?.destroy();
      this.contextMenu = null;
      return;
    }

    if (this.contextMenu) {
      this.contextMenu.updateNode(this.node);
      return;
    }

    this.contextMenu = attachPreviewContextMenu({
      element: this.dom,
      fileBaseName: 'html-block',
      getPos: this.getPos,
      node: this.node,
      view: this.view,
    });
  }

  update(node: ProseNode) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    const value = sanitizeRawMarkdownHtmlValue(getHtmlBlockNodeValue(node));
    if (this.dom.dataset.value !== value) {
      renderRawMarkdownHtmlValueIntoElement(this.dom, value);
    }

    this.ensureContextMenu();
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
    this.contextMenu?.destroy();
    this.contextMenu = null;
  }
}
