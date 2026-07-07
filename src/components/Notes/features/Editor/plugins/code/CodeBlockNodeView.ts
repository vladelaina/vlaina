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
import { installCodeBlockNodeViewInitializationMethods } from './CodeBlockNodeViewInitializationMethods';
import { installCodeBlockNodeViewKeyboardMethods } from './CodeBlockNodeViewKeyboardMethods';
import { installCodeBlockNodeViewLifecycleMethods } from './CodeBlockNodeViewLifecycleMethods';
import { installCodeBlockNodeViewSelectionGeometryMethods } from './CodeBlockNodeViewSelectionGeometryMethods';
import { installCodeBlockNodeViewSelectionSyncMethods } from './CodeBlockNodeViewSelectionSyncMethods';
import { installCodeBlockNodeViewStateMethods } from './CodeBlockNodeViewStateMethods';
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

export { MAX_LAZY_CODE_BLOCK_LINE_NUMBER_PLACEHOLDER_LINES } from './CodeBlockNodeViewConstants';

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
      'code-block-chrome',
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

  private readonly activateCodeMirrorFromInteraction = () => {
    this.initializeCodeMirror();
  };

  private readonly trackCodeMirrorSelectionKeydown = (event: KeyboardEvent) => {
    this.rememberCodeMirrorSelectionArrowKey(event);
  };

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
}

installCodeBlockNodeViewInitializationMethods(CodeBlockNodeView.prototype);
installCodeBlockNodeViewKeyboardMethods(CodeBlockNodeView.prototype);
installCodeBlockNodeViewLifecycleMethods(CodeBlockNodeView.prototype);
installCodeBlockNodeViewSelectionGeometryMethods(CodeBlockNodeView.prototype);
installCodeBlockNodeViewSelectionSyncMethods(CodeBlockNodeView.prototype);
installCodeBlockNodeViewStateMethods(CodeBlockNodeView.prototype);
