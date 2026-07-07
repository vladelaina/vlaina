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
import { FOCUSED_CODE_BLOCK_FORWARD_DEBOUNCE_MS } from './CodeBlockNodeViewConstants';

class CodeBlockNodeViewStateMethods {
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

}

function installMixinMethods(prototype: object, mixinPrototype: object): void {
  for (const key of Object.getOwnPropertyNames(mixinPrototype)) {
    if (key !== 'constructor') {
      Object.defineProperty(prototype, key, Object.getOwnPropertyDescriptor(mixinPrototype, key)!);
    }
  }
}

export function installCodeBlockNodeViewStateMethods(prototype: object): void {
  installMixinMethods(prototype, CodeBlockNodeViewStateMethods.prototype);
}
