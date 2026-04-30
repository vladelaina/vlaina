import { Node } from '@milkdown/kit/prose/model';
import { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView as CodeMirror,
  drawSelection,
  keymap as codeMirrorKeymap,
  type KeyBinding,
  type ViewUpdate,
} from '@codemirror/view';
import { codeBlockLanguageLoader } from '../code/codeBlockLanguageLoader';
import {
  bindCodeBlockFontMetricsSync,
  computeCodeBlockChange,
  createCodeBlockEditorKeymap,
  createCodeBlockEditorTheme,
  mapDocumentOffsetToCodeBlockEditorOffset,
  normalizeCodeBlockEditorText,
} from '../code/codemirror';
import { getEditorFindState } from '../find/editorFindCommands';
import {
  buildCodeMirrorFindHighlightRanges,
  codeMirrorFindHighlightExtensions,
  syncCodeMirrorFindHighlights,
} from '../find/editorFindCodeMirrorHighlights';
import { forwardCodeBlockUpdate } from '../code/codeBlockNodeViewUtils';
import { subscribeCodeBlockSelectionSync } from '../code/codeBlockSelectionSync';
import { deleteSelectedFrontmatterBlocks } from './frontmatterBlockSelection';

export class FrontmatterNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  node: Node;
  view: EditorView;
  getPos: () => number | undefined;

  private readonly editorDOM: HTMLElement;
  private readonly cm: CodeMirror;
  private readonly languageCompartment = new Compartment();
  private readonly readOnlyCompartment = new Compartment();
  private updating = false;
  private selected = false;
  private pendingMeasureFrame: number | null = null;
  private readonly disposeFontMetricsSync: () => void;
  private readonly unsubscribeSelectionSync: () => void;
  private destroyed = false;

  private getOwnerDocument(): Document | null {
    return (
      this.dom.ownerDocument ??
      this.editorDOM.ownerDocument ??
      (this.view.root instanceof Document ? this.view.root : this.view.root.ownerDocument) ??
      null
    );
  }

  private getOwnerWindow(): Window | null {
    return this.getOwnerDocument()?.defaultView ?? null;
  }

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.dom.classList.add('frontmatter-block-container', 'my-4');

    this.editorDOM = document.createElement('div');
    this.editorDOM.className = 'frontmatter-block-editor';
    this.dom.appendChild(this.editorDOM);

    this.cm = new CodeMirror({
      root: this.view.root,
      parent: this.editorDOM,
      state: EditorState.create({
        doc: normalizeCodeBlockEditorText(this.node.textContent),
        extensions: [
          this.readOnlyCompartment.of(EditorState.readOnly.of(!this.view.editable)),
          this.languageCompartment.of([]),
          CodeMirror.lineWrapping,
          drawSelection(),
          ...codeMirrorFindHighlightExtensions,
          ...createCodeBlockEditorTheme(),
          codeMirrorKeymap.of(this.createKeymap()),
          EditorState.changeFilter.of(() => this.view.editable),
          CodeMirror.updateListener.of(this.handleUpdate),
        ],
      }),
    });

    this.disposeFontMetricsSync = bindCodeBlockFontMetricsSync(
      this.dom.ownerDocument,
      () => this.scheduleMeasure()
    );
    this.unsubscribeSelectionSync = subscribeCodeBlockSelectionSync(
      this.dom.ownerDocument,
      this.syncProseMirrorSelection
    );

    this.updatePlaceholder();
    this.syncFindHighlights();
    void this.syncLanguage();
  }

  private createKeymap(): KeyBinding[] {
    return [
      {
        key: 'Backspace',
        run: () => deleteSelectedFrontmatterBlocks(this.view, this.getPos(), this.node.nodeSize),
      },
      {
        key: 'Delete',
        run: () => deleteSelectedFrontmatterBlocks(this.view, this.getPos(), this.node.nodeSize),
      },
      ...createCodeBlockEditorKeymap({
        getCodeMirror: () => this.cm,
        view: this.view,
        getNode: () => this.node,
        getPos: this.getPos,
      }),
    ];
  }

  private syncFindHighlights() {
    const nodePos = this.getPos();
    if (nodePos === undefined) {
      syncCodeMirrorFindHighlights(this.cm, []);
      return;
    }

    const state = getEditorFindState(this.view);
    if (!state || state.matches.length === 0) {
      syncCodeMirrorFindHighlights(this.cm, []);
      return;
    }

    const contentFrom = nodePos + 1;
    const contentTo = nodePos + this.node.nodeSize - 1;

    syncCodeMirrorFindHighlights(
      this.cm,
      buildCodeMirrorFindHighlightRanges({
        matches: state.matches,
        activeIndex: state.activeIndex,
        contentFrom,
        contentTo,
        rawText: this.node.textContent ?? '',
        mapDocumentOffsetToEditorOffset: mapDocumentOffsetToCodeBlockEditorOffset,
      }),
    );
  }

  private readonly syncProseMirrorSelection = () => {
    const nodePos = this.getPos();
    if (nodePos === undefined) {
      this.dom.dataset.pmSelected = 'false';
      return;
    }

    const contentFrom = nodePos + 1;
    const contentTo = nodePos + this.node.nodeSize - 1;
    const selectionFrom = Math.max(this.view.state.selection.from, contentFrom);
    const selectionTo = Math.min(this.view.state.selection.to, contentTo);
    const hasSelection = selectionTo > selectionFrom;

    this.dom.dataset.pmSelected = hasSelection ? 'true' : 'false';

    if (!hasSelection || this.cm.hasFocus) {
      return;
    }

    const rawText = this.node.textContent ?? '';
    const nextAnchor = mapDocumentOffsetToCodeBlockEditorOffset(rawText, selectionFrom - contentFrom);
    const nextHead = mapDocumentOffsetToCodeBlockEditorOffset(rawText, selectionTo - contentFrom);

    this.updating = true;
    this.cm.dispatch({
      selection: {
        anchor: nextAnchor,
        head: nextHead,
      },
    });
    this.updating = false;
  };

  private handleUpdate = (update: ViewUpdate) => {
    this.updatePlaceholder();

    if (this.updating || !this.cm.hasFocus) {
      return;
    }

    const tr = forwardCodeBlockUpdate(update, this.view, this.getPos);
    if (tr) {
      this.view.dispatch(tr);
    }
  };

  private updatePlaceholder() {
    this.dom.dataset.empty = this.cm.state.doc.length === 0 ? 'true' : 'false';
  }

  private scheduleMeasure() {
    if (this.destroyed) {
      return;
    }

    const window = this.getOwnerWindow();
    if (!window) {
      this.cm.requestMeasure();
      return;
    }

    if (this.pendingMeasureFrame !== null) {
      window.cancelAnimationFrame(this.pendingMeasureFrame);
    }

    this.pendingMeasureFrame = window.requestAnimationFrame(() => {
      this.pendingMeasureFrame = null;
      this.cm.requestMeasure();
    });
  }

  private async syncLanguage() {
    const support = await codeBlockLanguageLoader.load('yaml');
    if (this.destroyed) {
      return;
    }

    this.cm.dispatch({
      effects: this.languageCompartment.reconfigure(support ? [support] : []),
    });
    this.scheduleMeasure();
  }

  update(node: Node) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;

    const effects = [];
    if (this.view.editable === this.cm.state.readOnly) {
      effects.push(this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(!this.view.editable)));
    }
    if (effects.length > 0) {
      this.cm.dispatch({ effects });
    }

    const nextText = normalizeCodeBlockEditorText(node.textContent);
    const change = computeCodeBlockChange(this.cm.state.doc.toString(), nextText);
    if (change) {
      this.updating = true;
      this.cm.dispatch({
        changes: {
          from: change.from,
          to: change.to,
          insert: change.text,
        },
      });
      this.updating = false;
    }

    this.updatePlaceholder();
    this.syncFindHighlights();
    this.syncProseMirrorSelection();
    this.scheduleMeasure();

    if (this.selected) {
      this.cm.focus();
    }

    return true;
  }

  selectNode() {
    this.selected = true;
    this.dom.classList.add('ProseMirror-selectednode');
    this.cm.focus();
  }

  deselectNode() {
    this.selected = false;
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  setSelection(anchor: number, head: number) {
    if (!this.cm.dom.isConnected) {
      return;
    }

    const rawText = this.node.textContent ?? '';
    const nextAnchor = mapDocumentOffsetToCodeBlockEditorOffset(rawText, anchor);
    const nextHead = mapDocumentOffsetToCodeBlockEditorOffset(rawText, head);

    this.updating = true;
    this.cm.focus();
    this.cm.dispatch({
      selection: {
        anchor: nextAnchor,
        head: nextHead,
      },
    });
    this.updating = false;
  }

  stopEvent(event: Event) {
    const target = event.target;
    return target instanceof globalThis.Node && this.dom.contains(target);
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: globalThis.Node }) {
    return mutation.type !== 'selection';
  }

  destroy() {
    this.destroyed = true;
    const window = this.getOwnerWindow();
    if (window && this.pendingMeasureFrame !== null) {
      window.cancelAnimationFrame(this.pendingMeasureFrame);
      this.pendingMeasureFrame = null;
    }
    this.disposeFontMetricsSync();
    this.unsubscribeSelectionSync();
    this.cm.destroy();
    this.dom.remove();
  }
}
