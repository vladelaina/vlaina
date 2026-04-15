import { Node } from '@milkdown/kit/prose/model';
import { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView as CodeMirror,
  drawSelection,
  keymap as codeMirrorKeymap,
  lineNumbers,
  type KeyBinding,
  type ViewUpdate,
} from '@codemirror/view';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { selectCodeBlockLineNumbersEnabled } from '@/stores/unified/settings/markdownSettings';
import { CodeBlockView } from './CodeBlockView';
import { codeBlockLanguageLoader } from './codeBlockLanguageLoader';
import {
  bindCodeBlockFontMetricsSync,
  computeCodeBlockChange,
  createCodeBlockEditorKeymap,
  createCodeBlockEditorTheme,
  mapDocumentOffsetToCodeBlockEditorOffset,
  normalizeCodeBlockEditorText,
} from './codemirror';
import { getEditorFindState } from '../find/editorFindCommands';
import {
  buildCodeMirrorFindHighlightRanges,
  codeMirrorFindHighlightExtensions,
  syncCodeMirrorFindHighlights,
} from '../find/editorFindCodeMirrorHighlights';
import {
  applyCodeBlockCollapsedState,
  forwardCodeBlockUpdate,
} from './codeBlockNodeViewUtils';

export class CodeBlockNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  node: Node;
  view: EditorView;
  getPos: () => number | undefined;
  root: Root;
  headerDOM: HTMLElement;

  private readonly editorDOM: HTMLElement;
  private readonly cm: CodeMirror;
  private readonly languageCompartment = new Compartment();
  private readonly readOnlyCompartment = new Compartment();
  private readonly lineNumbersCompartment = new Compartment();
  private readonly wrapCompartment = new Compartment();
  private updating = false;
  private language = '';
  private selected = false;
  private headerStateKey = '';
  private pendingMeasureFrame: number | null = null;
  private pendingSelectionSyncFrame: number | null = null;
  private readonly disposeFontMetricsSync: () => void;
  private readonly unsubscribeSettings: () => void;
  private showLineNumbers = selectCodeBlockLineNumbersEnabled(useUnifiedStore.getState());

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
    this.dom.classList.add(
      'code-block-container',
      'my-4',
      'rounded-2xl',
      'overflow-hidden',
      'group/code',
      'transition-all'
    );

    this.headerDOM = document.createElement('div');
    this.headerDOM.contentEditable = 'false';
    this.dom.appendChild(this.headerDOM);

    this.editorDOM = document.createElement('div');
    this.editorDOM.className = 'code-block-editable';
    this.dom.appendChild(this.editorDOM);

    this.cm = new CodeMirror({
      root: this.view.root,
      parent: this.editorDOM,
      state: EditorState.create({
        doc: normalizeCodeBlockEditorText(this.node.textContent),
        extensions: [
          this.readOnlyCompartment.of(EditorState.readOnly.of(!this.view.editable)),
          this.languageCompartment.of([]),
          this.lineNumbersCompartment.of(this.getLineNumberExtensions(this.node)),
          this.wrapCompartment.of(this.node.attrs.wrap ? [CodeMirror.lineWrapping] : []),
          drawSelection(),
          ...codeMirrorFindHighlightExtensions,
          ...createCodeBlockEditorTheme(),
          codeMirrorKeymap.of(this.createKeymap()),
          EditorState.changeFilter.of(() => this.view.editable),
          CodeMirror.updateListener.of(this.forwardUpdate),
        ],
      }),
    });
    this.disposeFontMetricsSync = bindCodeBlockFontMetricsSync(
      this.dom.ownerDocument,
      () => this.scheduleMeasure()
    );
    this.unsubscribeSettings = useUnifiedStore.subscribe((state, previousState) => {
      const nextShowLineNumbers = selectCodeBlockLineNumbersEnabled(state);
      const previousShowLineNumbers = selectCodeBlockLineNumbersEnabled(previousState);

      if (nextShowLineNumbers === previousShowLineNumbers) {
        return;
      }

      this.showLineNumbers = nextShowLineNumbers;
      this.cm.dispatch({
        effects: this.lineNumbersCompartment.reconfigure(this.getLineNumberExtensions(this.node)),
      });
      this.scheduleMeasure();
    });
    this.dom.ownerDocument?.addEventListener('selectionchange', this.handleDocumentSelectionChange);

    this.applyCollapsedState();
    this.syncFindHighlights();
    this.syncProseMirrorSelection();
    this.root = createRoot(this.headerDOM);
    this.render();
    void this.syncLanguage();
  }

  private getLineNumberExtensions(node: Node) {
    return this.showLineNumbers && node.attrs.lineNumbers !== false ? [lineNumbers()] : [];
  }

  private render() {
    this.headerStateKey = this.getHeaderStateKey(this.node);
    this.root.render(
      React.createElement(CodeBlockView, {
        node: this.node,
        view: this.view,
        getPos: this.getPos,
        getNode: () => this.node,
      })
    );
    this.scheduleMeasure();
  }

  private getHeaderStateKey(node: Node) {
    return JSON.stringify({
      language: node.attrs.language ?? '',
      collapsed: Boolean(node.attrs.collapsed),
    });
  }

  private createKeymap(): KeyBinding[] {
    return createCodeBlockEditorKeymap({
      getCodeMirror: () => this.cm,
      view: this.view,
      getNode: () => this.node,
      getPos: this.getPos,
    });
  }

  private forwardUpdate = (update: ViewUpdate) => {
    if (this.updating || !this.cm.hasFocus) {
      return;
    }

    const tr = forwardCodeBlockUpdate(update, this.view, this.getPos);
    if (tr) {
      this.view.dispatch(tr);
    }
  };

  private applyCollapsedState() {
    applyCodeBlockCollapsedState(this.dom, this.editorDOM, Boolean(this.node.attrs.collapsed));
    this.scheduleMeasure();
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

  private syncProseMirrorSelection() {
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

    if (!hasSelection || this.cm.hasFocus || this.node.attrs.collapsed) {
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
  }

  private readonly handleDocumentSelectionChange = () => {
    const window = this.getOwnerWindow();
    if (!window) {
      this.syncProseMirrorSelection();
      return;
    }

    if (this.pendingSelectionSyncFrame !== null) {
      window.cancelAnimationFrame(this.pendingSelectionSyncFrame);
    }

    this.pendingSelectionSyncFrame = window.requestAnimationFrame(() => {
      this.pendingSelectionSyncFrame = null;
      this.syncProseMirrorSelection();
    });
  };

  private scheduleMeasure() {
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
    const nextLanguage = this.node.attrs.language ?? '';
    if (nextLanguage === this.language) {
      return;
    }

    let support;
    try {
      support = await codeBlockLanguageLoader.load(nextLanguage);
    } catch {
      return;
    }
    if (this.node.attrs.language !== nextLanguage) {
      return;
    }

    this.cm.dispatch({
      effects: this.languageCompartment.reconfigure(support ? [support] : []),
    });
    this.language = nextLanguage;
    this.scheduleMeasure();
  }

  update(node: Node) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    this.applyCollapsedState();
    if (this.getHeaderStateKey(node) !== this.headerStateKey) {
      this.render();
    }
    void this.syncLanguage();

    const effects = [];
    if (this.view.editable === this.cm.state.readOnly) {
      effects.push(this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(!this.view.editable)));
    }
    effects.push(
      this.lineNumbersCompartment.reconfigure(this.getLineNumberExtensions(node)),
      this.wrapCompartment.reconfigure(node.attrs.wrap ? [CodeMirror.lineWrapping] : [])
    );
    if (effects.length > 0) {
      this.cm.dispatch({ effects });
      this.scheduleMeasure();
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
      this.scheduleMeasure();
    }

    this.syncFindHighlights();
    this.syncProseMirrorSelection();

    if (this.selected) {
      this.cm.focus();
    }

    return true;
  }

  selectNode() {
    this.selected = true;
    this.dom.classList.add('ProseMirror-selectednode');
    if (!this.node.attrs.collapsed) {
      this.cm.focus();
    }
  }

  deselectNode() {
    this.selected = false;
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  setSelection(anchor: number, head: number) {
    if (!this.cm.dom.isConnected || this.node.attrs.collapsed) {
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
    const window = this.getOwnerWindow();
    if (window && this.pendingMeasureFrame !== null) {
      window.cancelAnimationFrame(this.pendingMeasureFrame);
      this.pendingMeasureFrame = null;
    }
    if (window && this.pendingSelectionSyncFrame !== null) {
      window.cancelAnimationFrame(this.pendingSelectionSyncFrame);
      this.pendingSelectionSyncFrame = null;
    }
    this.unsubscribeSettings();
    this.disposeFontMetricsSync();
    this.dom.ownerDocument?.removeEventListener('selectionchange', this.handleDocumentSelectionChange);
    this.root.unmount();
    this.cm.destroy();
    this.dom.remove();
  }
}
