import { Node } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
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
  createCodeBlockEditorClipboardHandlers,
  createCodeBlockEditorKeymap,
  createCodeBlockEditorTheme,
  mapCodeBlockEditorOffsetToDocumentOffset,
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
import { themeLazyLoadTokens } from '@/styles/themeTokens';

type CodeBlockNodeViewOptions = {
  lazyCodeMirror?: boolean;
};

const FOCUSED_CODE_BLOCK_FORWARD_DEBOUNCE_MS = 80;
export const MAX_LAZY_CODE_BLOCK_LINE_NUMBER_PLACEHOLDER_LINES = 20_000;

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
  private lineNumberPlaceholderDOM: HTMLPreElement | null = null;
  private cm: CodeMirror | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private readonly languageCompartment = new Compartment();
  private readonly readOnlyCompartment = new Compartment();
  private readonly lineNumbersCompartment = new Compartment();
  private readonly wrapCompartment = new Compartment();
  private updating = false;
  private language = '';
  private pendingLanguage: string | null = null;
  private selected = false;
  private headerStateKey = '';
  private pendingMeasureFrame: number | null = null;
  private pendingForwardTimer: number | null = null;
  private disposeFontMetricsSync: () => void = () => {};
  private unsubscribeSettings: () => void = () => {};
  private unsubscribeSelectionSync: () => void = () => {};
  private destroyed = false;
  private showLineNumbers = selectCodeBlockLineNumbersEnabled(useUnifiedStore.getState());
  private lineNumbersStateKey = '';
  private wrapStateKey = '';
  private collapsedState: boolean | null = null;
  private findHighlightStateKey = '[]';
  private mirroredOuterSelection = false;
  private languageClassName: string | null = null;

  private isPasteUpdate(update: ViewUpdate) {
    return update.transactions.some((transaction) => {
      const userEvent = transaction.annotation(Transaction.userEvent);
      return userEvent === 'input.paste' || userEvent?.startsWith('input.paste.');
    });
  }

  private readonly clearEditorSelectionOnBlur = (event: FocusEvent) => {
    if (!this.cm) {
      return;
    }

    if (this.pendingForwardTimer !== null) {
      this.clearPendingForwardUpdate();
      this.forwardFocusedCodeMirrorSnapshot();
    }

    if (!(event.relatedTarget instanceof globalThis.Node)) {
      return;
    }

    const { main } = this.cm.state.selection;
    if (main.empty) {
      return;
    }

    this.updating = true;
    this.cm.dispatch({
      selection: {
        anchor: main.head,
        head: main.head,
      },
    });
    this.updating = false;
  };

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

  constructor(
    node: Node,
    view: EditorView,
    getPos: () => number | undefined,
    private readonly options: CodeBlockNodeViewOptions = {},
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.dom.classList.add(
      'code-block-container',
      'el-pre',
      'editor-code-block',
      'md-fences',
      'HyperMD-codeblock',
      'HyperMD-codeblock-bg',
      'cm-line',
      'my-4',
      'rounded-2xl',
      'overflow-hidden',
      'group/code'
    );
    this.syncThemeCompatibilityAttrs();

    this.headerDOM = document.createElement('div');
    this.headerDOM.contentEditable = 'false';
    this.headerDOM.setAttribute('data-no-editor-drag-box', 'true');
    this.dom.appendChild(this.headerDOM);

    this.editorDOM = document.createElement('div');
    this.editorDOM.className = 'code-block-editable CodeMirror cm-s-inner cm-s-obsidian';
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
    return (
      Boolean(this.options.lazyCodeMirror) &&
      typeof window !== 'undefined' &&
      typeof IntersectionObserver !== 'undefined'
    );
  }

  private installLazyPlaceholder() {
    this.dom.dataset.cmLazy = 'true';
    this.editorDOM.classList.add('code-block-lazy-editable');

    if (this.getLineNumberExtensions(this.node).length > 0) {
      this.lineNumberPlaceholderDOM = this.createLineNumberPlaceholder(this.node.textContent);
      this.editorDOM.appendChild(this.lineNumberPlaceholderDOM);
    }

    this.placeholderDOM = document.createElement('pre');
    this.placeholderDOM.className = 'code-block-lazy-preview CodeMirror-code';
    this.placeholderDOM.textContent = this.node.textContent;
    this.editorDOM.appendChild(this.placeholderDOM);
    this.syncCollapsedState();

    this.dom.addEventListener('mousedown', this.activateCodeMirrorFromInteraction);
    this.dom.addEventListener('focusin', this.activateCodeMirrorFromInteraction);

    this.intersectionObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.initializeCodeMirror();
      }
    }, { rootMargin: themeLazyLoadTokens.codeBlockRootMargin });
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
    this.lineNumberPlaceholderDOM?.remove();
    this.lineNumberPlaceholderDOM = null;
    this.editorDOM.classList.remove('code-block-lazy-editable');
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
          CodeMirror.domEventHandlers(this.createClipboardHandlers()),
          EditorState.changeFilter.of(() => this.view.editable),
          CodeMirror.updateListener.of(this.forwardUpdate),
        ],
      }),
    });
    this.lineNumbersStateKey = this.getLineNumbersStateKey(this.node);
    this.wrapStateKey = this.getWrapStateKey(this.node);
    this.cm.dom.addEventListener('blur', this.clearEditorSelectionOnBlur, true);
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
      const nextLineNumbersStateKey = this.getLineNumbersStateKey(this.node);
      if (nextLineNumbersStateKey === this.lineNumbersStateKey) {
        return;
      }

      this.lineNumbersStateKey = nextLineNumbersStateKey;
      this.cm?.dispatch({
        effects: this.lineNumbersCompartment.reconfigure(this.getLineNumberExtensions(this.node)),
      });
      this.scheduleMeasure();
    });
    this.unsubscribeSelectionSync = subscribeCodeBlockSelectionSync(
      this.dom.ownerDocument,
      this.syncProseMirrorSelection
    );

    this.syncCollapsedState();
    this.syncFindHighlights();
    this.syncProseMirrorSelection();
    void this.syncLanguage();
  }

  private getLineNumberExtensions(node: Node) {
    return this.showLineNumbers && node.attrs.lineNumbers !== false ? [lineNumbers()] : [];
  }

  private createLineNumberPlaceholder(text: string) {
    const lineNumbers = document.createElement('pre');
    lineNumbers.className = 'code-block-lazy-line-numbers';
    let lineCount = 1;
    let searchFrom = 0;
    while (lineCount < MAX_LAZY_CODE_BLOCK_LINE_NUMBER_PLACEHOLDER_LINES) {
      const nextNewline = text.indexOf('\n', searchFrom);
      if (nextNewline === -1) {
        break;
      }
      lineCount += 1;
      searchFrom = nextNewline + 1;
    }
    lineNumbers.textContent = Array.from({ length: lineCount }, (_value, index) => String(index + 1)).join('\n');
    return lineNumbers;
  }

  private getLineNumbersStateKey(node: Node) {
    return `${this.showLineNumbers ? '1' : '0'}:${node.attrs.lineNumbers !== false ? '1' : '0'}`;
  }

  private getWrapStateKey(node: Node) {
    return node.attrs.wrap ? '1' : '0';
  }

  private syncThemeCompatibilityAttrs() {
    const language = typeof this.node.attrs.language === 'string' ? this.node.attrs.language : '';
    this.dom.dataset.language = language;
    this.dom.setAttribute('lang', language);

    if (this.languageClassName) {
      this.dom.classList.remove(this.languageClassName);
      this.languageClassName = null;
    }

    if (language) {
      this.languageClassName = `language-${language}`;
      this.dom.classList.add(this.languageClassName);
    }
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

  private createClipboardHandlers() {
    return createCodeBlockEditorClipboardHandlers({
      view: this.view,
      getNode: () => this.node,
      getPos: this.getPos,
    });
  }

  private forwardUpdate = (update: ViewUpdate) => {
    if (
      this.updating ||
      (!this.cm?.hasFocus && !(this.mirroredOuterSelection && update.docChanged))
    ) {
      return;
    }

    if (update.docChanged && this.cm?.hasFocus && !this.isPasteUpdate(update)) {
      this.view.dom.dispatchEvent(new CustomEvent('editor:block-user-input', { bubbles: true }));
      this.scheduleForwardFocusedCodeMirrorSnapshot();
      return;
    }

    const tr = forwardCodeBlockUpdate(update, this.view, this.getPos);
    if (tr) {
      if (update.docChanged) {
        this.view.dom.dispatchEvent(new CustomEvent('editor:block-user-input', { bubbles: true }));
      }
      this.view.dispatch(tr);
      if (update.docChanged) {
        this.mirroredOuterSelection = false;
      }
    }
  };

  private scheduleForwardFocusedCodeMirrorSnapshot() {
    const window = this.getOwnerWindow();
    if (!window) {
      this.forwardFocusedCodeMirrorSnapshot();
      return;
    }

    if (this.pendingForwardTimer !== null) {
      window.clearTimeout(this.pendingForwardTimer);
    }

    this.pendingForwardTimer = window.setTimeout(() => {
      this.pendingForwardTimer = null;
      this.forwardFocusedCodeMirrorSnapshot();
    }, FOCUSED_CODE_BLOCK_FORWARD_DEBOUNCE_MS);
  }

  private clearPendingForwardUpdate() {
    const window = this.getOwnerWindow();
    if (window && this.pendingForwardTimer !== null) {
      window.clearTimeout(this.pendingForwardTimer);
    }
    this.pendingForwardTimer = null;
  }

  private forwardFocusedCodeMirrorSnapshot() {
    if (!this.cm || this.updating || this.destroyed) {
      return;
    }

    const codeBlockPos = this.getPos();
    if (codeBlockPos === undefined) {
      return;
    }

    const currentNode = typeof this.view.state.doc.nodeAt === 'function'
      ? this.view.state.doc.nodeAt(codeBlockPos)
      : null;
    if (!currentNode || currentNode.type !== this.node.type) {
      return;
    }

    const currentText = normalizeCodeBlockEditorText(currentNode.textContent);
    const nextText = this.cm.state.doc.toString();
    const change = computeCodeBlockChange(currentText, nextText);
    const codeBlockStart = codeBlockPos + 1;
    const tr = this.view.state.tr;

    if (change) {
      const from = codeBlockStart + change.from;
      const to = codeBlockStart + change.to;
      if (change.text.length > 0) {
        tr.replaceWith(from, to, this.view.state.schema.text(change.text));
      } else {
        tr.delete(from, to);
      }
    }

    const { main } = this.cm.state.selection;
    const nextSelectionFrom =
      codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(nextText, main.from);
    const nextSelectionTo =
      codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(nextText, main.to);

    tr.setSelection(TextSelection.create(tr.doc, nextSelectionFrom, nextSelectionTo));
    if (change || this.view.state.selection.from !== nextSelectionFrom || this.view.state.selection.to !== nextSelectionTo) {
      this.view.dispatch(tr);
    }
    this.mirroredOuterSelection = false;
  }

  private syncCollapsedState() {
    const nextCollapsedState = Boolean(this.node.attrs.collapsed);
    if (nextCollapsedState === this.collapsedState) {
      return;
    }

    this.collapsedState = nextCollapsedState;
    applyCodeBlockCollapsedState(this.dom, this.editorDOM, nextCollapsedState);
    this.scheduleMeasure();
  }

  private syncFindHighlights() {
    if (!this.cm) {
      return;
    }

    const nodePos = this.getPos();
    if (nodePos === undefined) {
      this.syncFindHighlightRanges([]);
      return;
    }

    const state = getEditorFindState(this.view);
    if (!state || state.matches.length === 0) {
      this.syncFindHighlightRanges([]);
      return;
    }

    const contentFrom = nodePos + 1;
    const contentTo = nodePos + this.node.nodeSize - 1;

    this.syncFindHighlightRanges(
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

  private syncFindHighlightRanges(ranges: ReturnType<typeof buildCodeMirrorFindHighlightRanges>) {
    if (!this.cm) {
      return;
    }

    const nextFindHighlightStateKey = JSON.stringify(ranges);
    if (nextFindHighlightStateKey === this.findHighlightStateKey) {
      return;
    }

    this.findHighlightStateKey = nextFindHighlightStateKey;
    syncCodeMirrorFindHighlights(this.cm, ranges);
  }

  private readonly syncProseMirrorSelection = () => {
    const nodePos = this.getPos();
    if (nodePos === undefined) {
      this.dom.dataset.pmSelected = 'false';
      this.clearMirroredOuterSelection();
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
      this.clearMirroredOuterSelection();
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
    this.mirroredOuterSelection = true;
  };

  private clearMirroredOuterSelection() {
    if (!this.mirroredOuterSelection || !this.cm || this.cm.hasFocus) {
      if (!this.cm?.hasFocus) {
        this.mirroredOuterSelection = false;
      }
      return;
    }

    const { main } = this.cm.state.selection;
    if (!main.empty) {
      this.updating = true;
      this.cm.dispatch({
        selection: {
          anchor: main.head,
          head: main.head,
        },
      });
      this.updating = false;
    }
    this.mirroredOuterSelection = false;
  }

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
    if (nextLanguage === this.language || nextLanguage === this.pendingLanguage) {
      return;
    }

    this.pendingLanguage = nextLanguage;
    let support;
    try {
      support = await codeBlockLanguageLoader.load(nextLanguage);
    } catch {
      if (this.pendingLanguage === nextLanguage) {
        this.pendingLanguage = null;
      }
      return;
    }
    if (this.destroyed || this.node.attrs.language !== nextLanguage) {
      if (this.pendingLanguage === nextLanguage) {
        this.pendingLanguage = null;
      }
      return;
    }

    this.pendingLanguage = null;
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

    this.clearPendingForwardUpdate();
    this.node = node;
    this.syncThemeCompatibilityAttrs();
    if (!this.cm && this.placeholderDOM) {
      this.placeholderDOM.textContent = node.textContent;
      if (this.lineNumberPlaceholderDOM) {
        this.lineNumberPlaceholderDOM.textContent = this.createLineNumberPlaceholder(node.textContent).textContent;
      }
    }
    this.syncCollapsedState();
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
    const nextLineNumbersStateKey = this.getLineNumbersStateKey(node);
    if (nextLineNumbersStateKey !== this.lineNumbersStateKey) {
      this.lineNumbersStateKey = nextLineNumbersStateKey;
      effects.push(this.lineNumbersCompartment.reconfigure(this.getLineNumberExtensions(node)));
    }

    const nextWrapStateKey = this.getWrapStateKey(node);
    if (nextWrapStateKey !== this.wrapStateKey) {
      this.wrapStateKey = nextWrapStateKey;
      effects.push(this.wrapCompartment.reconfigure(node.attrs.wrap ? [CodeMirror.lineWrapping] : []));
    }
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
    this.dom.classList.add('ProseMirror-selectednode', 'md-focus');
    if (!this.node.attrs.collapsed) {
      this.initializeCodeMirror();
      this.cm?.focus();
    }
  }

  deselectNode() {
    this.selected = false;
    this.dom.classList.remove('ProseMirror-selectednode', 'md-focus');
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
    if (this.dom.dataset.pmSelected === 'true' || this.dom.classList.contains('editor-block-selected')) {
      if (event.type === 'copy' || event.type === 'cut' || event.type === 'paste') {
        return false;
      }

      if (event instanceof KeyboardEvent) {
        const key = event.key.toLowerCase();
        if (
          key === 'delete' ||
          key === 'backspace' ||
          ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && key === 'insert') ||
          (!(event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && key === 'insert') ||
          key === 'x' ||
          key === 'c'
        ) {
          return false;
        }
      }
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
    this.clearPendingForwardUpdate();
    this.unsubscribeSettings();
    this.unsubscribeSelectionSync();
    this.disposeFontMetricsSync();
    this.root.unmount();
    this.cm?.dom.removeEventListener('blur', this.clearEditorSelectionOnBlur, true);
    this.cm?.destroy();
    this.dom.remove();
  }
}
