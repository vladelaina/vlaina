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
import { subscribeCodeBlockSelectionSync } from './codeBlockSelectionSync';

export class CodeBlockNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  node: Node;
  view: EditorView;
  getPos: () => number | undefined;
  root: Root;
  headerDOM: HTMLElement;

  private readonly editorDOM: HTMLElement;
  private placeholderDOM: HTMLPreElement | null = null;
  private cm: CodeMirror | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private readonly languageCompartment = new Compartment();
  private readonly readOnlyCompartment = new Compartment();
  private readonly lineNumbersCompartment = new Compartment();
  private readonly wrapCompartment = new Compartment();
  private updating = false;
  private language = '';
  private selected = false;
  private headerStateKey = '';
  private pendingMeasureFrame: number | null = null;
  private disposeFontMetricsSync: () => void = () => {};
  private unsubscribeSettings: () => void = () => {};
  private unsubscribeSelectionSync: () => void = () => {};
  private destroyed = false;
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
      'vlaina-code-block',
      'my-4',
      'rounded-2xl',
      'overflow-hidden',
      'group/code'
    );

    this.headerDOM = document.createElement('div');
    this.headerDOM.contentEditable = 'false';
    this.dom.appendChild(this.headerDOM);

    this.editorDOM = document.createElement('div');
    this.editorDOM.className = 'code-block-editable';
    this.dom.appendChild(this.editorDOM);

    this.root = createRoot(this.headerDOM);
    this.render();
    if (this.shouldLazyInitializeCodeMirror()) {
      this.installLazyPlaceholder();
      return;
    }

    this.initializeCodeMirror();
  }

  private shouldLazyInitializeCodeMirror() {
    return typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined';
  }

  private installLazyPlaceholder() {
    this.dom.dataset.cmLazy = 'true';
    this.placeholderDOM = document.createElement('pre');
    this.placeholderDOM.className = 'code-block-lazy-preview';
    this.placeholderDOM.textContent = this.node.textContent;
    this.editorDOM.appendChild(this.placeholderDOM);

    this.dom.addEventListener('mousedown', this.activateCodeMirrorFromInteraction);
    this.dom.addEventListener('focusin', this.activateCodeMirrorFromInteraction);

    this.intersectionObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.initializeCodeMirror();
      }
    }, { rootMargin: '900px 0px' });
    this.intersectionObserver.observe(this.dom);
  }

  private readonly activateCodeMirrorFromInteraction = () => {
    this.initializeCodeMirror();
  };

  private initializeCodeMirror() {
    if (this.cm) {
      return;
    }

    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.dom.removeEventListener('mousedown', this.activateCodeMirrorFromInteraction);
    this.dom.removeEventListener('focusin', this.activateCodeMirrorFromInteraction);
    this.placeholderDOM?.remove();
    this.placeholderDOM = null;
    delete this.dom.dataset.cmLazy;

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
      this.cm?.dispatch({
        effects: this.lineNumbersCompartment.reconfigure(this.getLineNumberExtensions(this.node)),
      });
      this.scheduleMeasure();
    });
    this.unsubscribeSelectionSync = subscribeCodeBlockSelectionSync(
      this.dom.ownerDocument,
      this.syncProseMirrorSelection
    );

    this.applyCollapsedState();
    this.syncFindHighlights();
    this.syncProseMirrorSelection();
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
      getCodeMirror: () => this.cm ?? undefined,
      view: this.view,
      getNode: () => this.node,
      getPos: this.getPos,
    });
  }

  private forwardUpdate = (update: ViewUpdate) => {
    if (this.updating || !this.cm?.hasFocus) {
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
    if (!this.cm) {
      return;
    }

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
    const shouldMirrorOuterSelection = hasSelection && !this.cm?.hasFocus;

    this.dom.dataset.pmSelected = shouldMirrorOuterSelection ? 'true' : 'false';

    if (!shouldMirrorOuterSelection || this.node.attrs.collapsed) {
      return;
    }
    this.initializeCodeMirror();
    if (!this.cm) {
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

  private scheduleMeasure() {
    if (!this.cm) {
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
      this.cm?.requestMeasure();
    });
  }

  private async syncLanguage() {
    if (this.destroyed || !this.cm) {
      return;
    }

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
    if (this.destroyed || this.node.attrs.language !== nextLanguage) {
      return;
    }

    this.cm?.dispatch({
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
    if (!this.cm && this.placeholderDOM) {
      this.placeholderDOM.textContent = node.textContent;
    }
    this.applyCollapsedState();
    if (this.getHeaderStateKey(node) !== this.headerStateKey) {
      this.render();
    }
    void this.syncLanguage();

    if (!this.cm) {
      return true;
    }

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
      this.cm?.focus();
    }

    return true;
  }

  selectNode() {
    this.selected = true;
    this.dom.classList.add('ProseMirror-selectednode');
    if (!this.node.attrs.collapsed) {
      this.initializeCodeMirror();
      this.cm?.focus();
    }
  }

  deselectNode() {
    this.selected = false;
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  setSelection(anchor: number, head: number) {
    this.initializeCodeMirror();
    if (!this.cm || !this.cm.dom.isConnected || this.node.attrs.collapsed) {
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
    if (
      (this.dom.dataset.pmSelected === 'true' || this.dom.classList.contains('vlaina-block-selected')) &&
      event instanceof KeyboardEvent &&
      (event.key === 'Delete' || event.key === 'Backspace' || event.key.toLowerCase() === 'x' || event.key.toLowerCase() === 'c')
    ) {
      return false;
    }

    return target instanceof globalThis.Node && this.dom.contains(target);
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: globalThis.Node }) {
    return mutation.type !== 'selection';
  }

  destroy() {
    this.destroyed = true;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    const window = this.getOwnerWindow();
    if (window && this.pendingMeasureFrame !== null) {
      window.cancelAnimationFrame(this.pendingMeasureFrame);
      this.pendingMeasureFrame = null;
    }
    this.unsubscribeSettings();
    this.unsubscribeSelectionSync();
    this.disposeFontMetricsSync();
    this.root.unmount();
    this.cm?.destroy();
    this.dom.remove();
  }
}
