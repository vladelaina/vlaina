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

class CodeBlockNodeViewKeyboardMethods {
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

  private filterCodeMirrorSelectionEdgeLineBreaks(
    transaction: Transaction
  ): Transaction | readonly TransactionSpec[] {
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
  }

  private handleCodeMirrorKeydown(event: KeyboardEvent, cm: CodeMirror) {
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
  }

}

function installMixinMethods(prototype: object, mixinPrototype: object): void {
  for (const key of Object.getOwnPropertyNames(mixinPrototype)) {
    if (key !== 'constructor') {
      Object.defineProperty(prototype, key, Object.getOwnPropertyDescriptor(mixinPrototype, key)!);
    }
  }
}

export function installCodeBlockNodeViewKeyboardMethods(prototype: object): void {
  installMixinMethods(prototype, CodeBlockNodeViewKeyboardMethods.prototype);
}
