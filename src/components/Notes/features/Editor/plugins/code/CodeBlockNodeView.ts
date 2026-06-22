import { Node } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { Compartment, EditorSelection, EditorState, Prec, Transaction, type Text, type TransactionSpec } from '@codemirror/state';
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
  moveOrExtendToTrimmedCodeBoundary,
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
import { floatingToolbarKey } from '../floating-toolbar/floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../floating-toolbar/types';

type CodeBlockNodeViewOptions = {
  lazyCodeMirror?: boolean;
};

type CodeMirrorLineBounds = {
  from: number;
  to: number;
};

type CodeMirrorSelectionLike = {
  anchor: number;
  empty: boolean;
  from: number;
  head: number;
  to: number;
};

type NormalizedCodeMirrorSelection = {
  anchor: number;
  head: number;
};

type CodeMirrorSelectionArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

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
  private codeMirrorSelectionArrowKey: CodeMirrorSelectionArrowKey | null = null;
  private codeMirrorSelectionArrowResetTimer: number | null = null;

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
          Prec.highest(CodeMirror.domEventHandlers({
            ...this.createClipboardHandlers(),
            keydown: this.handleCodeMirrorKeydown,
          })),
          codeMirrorKeymap.of(this.createKeymap()),
          EditorState.changeFilter.of(() => this.view.editable),
          EditorState.transactionFilter.of(this.filterCodeMirrorSelectionEdgeLineBreaks),
          CodeMirror.updateListener.of(this.forwardUpdate),
        ],
      }),
    });
    this.lineNumbersStateKey = this.getLineNumbersStateKey(this.node);
    this.wrapStateKey = this.getWrapStateKey(this.node);
    this.cm.contentDOM.addEventListener('keydown', this.trackCodeMirrorSelectionKeydown, true);
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
    this.syncE2ECodeMirrorSelection();
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

  private getArrowKey(key: string): CodeMirrorSelectionArrowKey | null {
    return key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight'
      ? key
      : null;
  }

  private clearCodeMirrorSelectionArrowKey() {
    const ownerWindow = this.getOwnerWindow();
    if (ownerWindow && this.codeMirrorSelectionArrowResetTimer !== null) {
      ownerWindow.clearTimeout(this.codeMirrorSelectionArrowResetTimer);
    }
    this.codeMirrorSelectionArrowResetTimer = null;
    this.codeMirrorSelectionArrowKey = null;
  }

  private rememberCodeMirrorSelectionArrowKey(event: KeyboardEvent) {
    const arrowKey = this.getArrowKey(event.key);
    if (!arrowKey) {
      return;
    }

    this.codeMirrorSelectionArrowKey = event.shiftKey ? arrowKey : null;
    const ownerWindow = this.getOwnerWindow();
    if (!ownerWindow || this.codeMirrorSelectionArrowKey === null) {
      return;
    }

    if (this.codeMirrorSelectionArrowResetTimer !== null) {
      ownerWindow.clearTimeout(this.codeMirrorSelectionArrowResetTimer);
    }
    this.codeMirrorSelectionArrowResetTimer = ownerWindow.setTimeout(() => {
      this.codeMirrorSelectionArrowResetTimer = null;
      this.codeMirrorSelectionArrowKey = null;
    }, 750);
  }

  private shouldNormalizeCodeMirrorSelectionEdgeLineBreaks() {
    return this.codeMirrorSelectionArrowKey === 'ArrowUp' ||
      this.codeMirrorSelectionArrowKey === 'ArrowDown';
  }

  private readonly trackCodeMirrorSelectionKeydown = (event: KeyboardEvent) => {
    this.rememberCodeMirrorSelectionArrowKey(event);
  };

  private getNonEmptyLineBoundsAtOrAfter(doc: Text, pos: number): CodeMirrorLineBounds | null {
    if (doc.lines === 0) {
      return null;
    }

    const clampedPos = Math.max(0, Math.min(pos, doc.length));
    const startLine = doc.lineAt(clampedPos).number;
    for (let lineNumber = startLine; lineNumber <= doc.lines; lineNumber += 1) {
      const line = doc.line(lineNumber);
      if (line.text.trim().length > 0) {
        return { from: line.from, to: line.to };
      }
    }

    return null;
  }

  private getNonEmptyLineBoundsAtOrBefore(doc: Text, pos: number): CodeMirrorLineBounds | null {
    if (doc.lines === 0) {
      return null;
    }

    const clampedPos = Math.max(0, Math.min(pos, doc.length));
    const startLine = doc.lineAt(clampedPos).number;
    for (let lineNumber = startLine; lineNumber >= 1; lineNumber -= 1) {
      const line = doc.line(lineNumber);
      if (line.text.trim().length > 0) {
        return { from: line.from, to: line.to };
      }
    }

    return null;
  }

  private getAdjacentNonEmptyLineBounds(doc: Text, pos: number): CodeMirrorLineBounds | null {
    if (doc.lines === 0) {
      return null;
    }

    const clampedPos = Math.max(0, Math.min(pos, doc.length));
    const currentLine = doc.lineAt(clampedPos);
    if (currentLine.text.trim().length > 0) {
      return { from: currentLine.from, to: currentLine.to };
    }

    if (currentLine.number > 1) {
      const previousLine = doc.line(currentLine.number - 1);
      if (previousLine.text.trim().length > 0 && previousLine.to + 1 >= clampedPos) {
        return { from: previousLine.from, to: previousLine.to };
      }
    }

    if (currentLine.number < doc.lines) {
      const nextLine = doc.line(currentLine.number + 1);
      if (nextLine.text.trim().length > 0 && currentLine.to + 1 >= nextLine.from - 1) {
        return { from: nextLine.from, to: nextLine.to };
      }
    }

    return null;
  }

  private orientCodeMirrorLineSelection(
    lineBounds: CodeMirrorLineBounds,
    direction: -1 | 1
  ): NormalizedCodeMirrorSelection {
    return {
      anchor: direction > 0 ? lineBounds.from : lineBounds.to,
      head: direction > 0 ? lineBounds.to : lineBounds.from,
    };
  }

  private getPureLineBreakSelectionTarget(
    doc: Text,
    selection: CodeMirrorSelectionLike,
    direction: -1 | 1
  ): CodeMirrorLineBounds | null {
    const directionalTarget = direction > 0
      ? this.getNonEmptyLineBoundsAtOrAfter(doc, selection.to)
      : this.getNonEmptyLineBoundsAtOrBefore(doc, selection.from);
    if (directionalTarget) {
      return directionalTarget;
    }

    return (
      this.getAdjacentNonEmptyLineBounds(doc, selection.anchor) ??
      this.getAdjacentNonEmptyLineBounds(doc, selection.head) ??
      (direction > 0
        ? this.getNonEmptyLineBoundsAtOrBefore(doc, selection.from)
        : this.getNonEmptyLineBoundsAtOrAfter(doc, selection.to))
    );
  }

  private normalizeCodeMirrorSelectionEdgeLineBreaks(
    doc: Text,
    selection: CodeMirrorSelectionLike,
    previousSelection?: CodeMirrorSelectionLike
  ): NormalizedCodeMirrorSelection | null {
    if (selection.empty) {
      return null;
    }

    let nextFrom = selection.from;
    let nextTo = selection.to;
    while (nextFrom < nextTo && doc.sliceString(nextFrom, nextFrom + 1) === '\n') {
      nextFrom += 1;
    }
    while (nextTo > nextFrom && doc.sliceString(nextTo - 1, nextTo) === '\n') {
      nextTo -= 1;
    }

    const direction = selection.anchor <= selection.head ? 1 : -1;
    if (nextFrom >= nextTo) {
      const targetLine = this.getPureLineBreakSelectionTarget(doc, selection, direction);
      return targetLine
        ? this.orientCodeMirrorLineSelection(targetLine, direction)
        : null;
    }

    if (nextFrom === selection.from && nextTo === selection.to) {
      return null;
    }

    const previousRangeMatchesTrimmedSelection =
      previousSelection !== undefined &&
      !previousSelection.empty &&
      previousSelection.from === nextFrom &&
      previousSelection.to === nextTo;
    if (previousRangeMatchesTrimmedSelection) {
      const nextNonEmptyLine = direction > 0 && nextTo < selection.to
        ? this.getNonEmptyLineBoundsAtOrAfter(doc, selection.to)
        : direction < 0 && nextFrom > selection.from
          ? this.getNonEmptyLineBoundsAtOrBefore(doc, selection.from)
          : null;
      if (
        nextNonEmptyLine &&
        (nextNonEmptyLine.from !== nextFrom || nextNonEmptyLine.to !== nextTo)
      ) {
        return {
          anchor: direction > 0 ? previousSelection.from : previousSelection.to,
          head: direction > 0 ? nextNonEmptyLine.to : nextNonEmptyLine.from,
        };
      }
    }

    return {
      anchor: direction > 0 ? nextFrom : nextTo,
      head: direction > 0 ? nextTo : nextFrom,
    };
  }

  private readonly filterCodeMirrorSelectionEdgeLineBreaks = (
    transaction: Transaction
  ): Transaction | readonly TransactionSpec[] => {
    if (!transaction.selection || !transaction.isUserEvent('select')) {
      return transaction;
    }
    if (!this.shouldNormalizeCodeMirrorSelectionEdgeLineBreaks()) {
      return transaction;
    }

    const selection = transaction.newSelection.main;
    const normalizedSelection = this.normalizeCodeMirrorSelectionEdgeLineBreaks(
      transaction.newDoc,
      selection,
      transaction.startState.selection.main
    );
    if (!normalizedSelection) {
      return transaction;
    }

    const { anchor, head } = normalizedSelection;

    return [
      transaction,
      {
        selection: EditorSelection.single(anchor, head),
        sequential: true,
      },
    ];
  };

  private readonly handleCodeMirrorKeydown = (event: KeyboardEvent, cm: CodeMirror) => {
    if (
      !event.defaultPrevented &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
      cm.state.selection.main.empty
    ) {
      const toolbarState = floatingToolbarKey.getState(this.view.state);
      if (toolbarState?.isVisible) {
        this.view.dispatch(this.view.state.tr.setMeta(floatingToolbarKey, { type: TOOLBAR_ACTIONS.HIDE }));
      }
      return false;
    }

    if (
      event.defaultPrevented ||
      event.altKey ||
      event.isComposing ||
      (!event.ctrlKey && !event.metaKey)
    ) {
      return false;
    }

    const direction = event.key === 'ArrowUp'
      ? -1
      : event.key === 'ArrowDown'
        ? 1
        : null;
    if (direction === null) {
      return false;
    }

    if (cm.state.doc.toString().trim().length === 0) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const handled = moveOrExtendToTrimmedCodeBoundary(() => cm, direction, true);
    if (!handled) {
      return false;
    }

    const scheduledAnchor = cm.state.selection.main.anchor;
    const scheduledHead = cm.state.selection.main.head;
    this.restoreCodeMirrorSelectionAfterNativeKeyHandling(cm, scheduledAnchor, scheduledHead);

    return true;
  };

  private restoreCodeMirrorSelectionAfterNativeKeyHandling(
    cm: CodeMirror,
    anchor: number,
    head: number
  ) {
    const restore = () => {
      if (this.destroyed || this.cm !== cm) {
        return;
      }

      const selection = cm.state.selection.main;
      if (selection.anchor !== anchor || selection.head !== head) {
        cm.dispatch({ selection: { anchor, head } });
      }
      cm.focus();
      this.syncE2ECodeMirrorSelection();
    };

    const ownerWindow = this.getOwnerWindow();
    if (!ownerWindow) {
      restore();
      return;
    }

    ownerWindow.setTimeout(restore, 0);
    ownerWindow.requestAnimationFrame(() => {
      restore();
      ownerWindow.requestAnimationFrame(restore);
    });
  }

  private syncE2ECodeMirrorSelection() {
    if (!this.cm) {
      return;
    }

    const ownerWindow = this.getOwnerWindow();
    if (!ownerWindow?.location.search.includes('e2e=1')) {
      return;
    }

    const { main } = this.cm.state.selection;
    this.cm.dom.dataset.e2eSelectionAnchor = String(main.anchor);
    this.cm.dom.dataset.e2eSelectionHead = String(main.head);
    this.cm.dom.dataset.e2eSelectionFrom = String(main.from);
    this.cm.dom.dataset.e2eSelectionTo = String(main.to);
    this.cm.dom.dataset.e2eSelectionText = this.cm.state.sliceDoc(main.from, main.to);
  }

  private trimCodeMirrorSelectionEdgeLineBreaks(update: ViewUpdate) {
    if (!this.cm || !update.selectionSet) {
      return false;
    }

    const isKeyboardLikeSelection = (update.transactions ?? []).some((transaction) => {
      const userEvent = transaction.annotation(Transaction.userEvent);
      return userEvent === 'select' || userEvent?.startsWith('select.');
    });
    if (!isKeyboardLikeSelection || !this.shouldNormalizeCodeMirrorSelectionEdgeLineBreaks()) {
      return false;
    }

    const { main } = this.cm.state.selection;
    if (main.empty) {
      return false;
    }

    const normalizedSelection = this.normalizeCodeMirrorSelectionEdgeLineBreaks(
      this.cm.state.doc,
      main,
      update.startState.selection.main
    );
    if (!normalizedSelection) {
      return false;
    }

    const { anchor, head } = normalizedSelection;
    this.cm.dispatch({ selection: { anchor, head } });
    return true;
  }

  private forwardUpdate = (update: ViewUpdate) => {
    this.syncE2ECodeMirrorSelection();

    if (this.trimCodeMirrorSelectionEdgeLineBreaks(update)) {
      return;
    }

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
        if (event.isComposing) {
          return true;
        }

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
    this.clearCodeMirrorSelectionArrowKey();
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
    if (this.cm) {
      this.cm.contentDOM.removeEventListener('keydown', this.trackCodeMirrorSelectionKeydown, true);
      this.cm.dom.removeEventListener('blur', this.clearEditorSelectionOnBlur, true);
      this.cm.destroy();
    }
    this.dom.remove();
  }
}
