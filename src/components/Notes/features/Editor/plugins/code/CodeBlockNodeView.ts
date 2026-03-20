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
  private readonly disposeFontMetricsSync: () => void;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.dom.classList.add(
      'code-block-container',
      'my-4',
      'rounded-xl',
      'border',
      'border-gray-200',
      'dark:border-zinc-800',
      'bg-white',
      'dark:bg-[#1e1e1e]',
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
          this.lineNumbersCompartment.of(this.node.attrs.lineNumbers ? [lineNumbers()] : []),
          this.wrapCompartment.of(this.node.attrs.wrap ? [CodeMirror.lineWrapping] : []),
          drawSelection(),
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

    this.applyCollapsedState();
    this.root = createRoot(this.headerDOM);
    this.render();
    void this.syncLanguage();
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

  private scheduleMeasure() {
    const ownerDocument =
      this.dom.ownerDocument ??
      this.editorDOM.ownerDocument ??
      (this.view.root instanceof Document ? this.view.root : this.view.root.ownerDocument);
    const view = ownerDocument?.defaultView;
    if (!view) {
      this.cm.requestMeasure();
      return;
    }

    if (this.pendingMeasureFrame !== null) {
      view.cancelAnimationFrame(this.pendingMeasureFrame);
    }

    this.pendingMeasureFrame = view.requestAnimationFrame(() => {
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
      this.lineNumbersCompartment.reconfigure(node.attrs.lineNumbers ? [lineNumbers()] : []),
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
    const ownerDocument =
      this.dom.ownerDocument ??
      this.editorDOM.ownerDocument ??
      (this.view.root instanceof Document ? this.view.root : this.view.root.ownerDocument);
    const view = ownerDocument?.defaultView;
    if (view && this.pendingMeasureFrame !== null) {
      view.cancelAnimationFrame(this.pendingMeasureFrame);
      this.pendingMeasureFrame = null;
    }
    this.disposeFontMetricsSync();
    this.root.unmount();
    this.cm.destroy();
    this.dom.remove();
  }
}
