import { EditorSelection, Transaction, type TransactionSpec } from '@codemirror/state';
import {
  EditorView as CodeMirror
} from '@codemirror/view';
import { floatingToolbarKey } from '../floating-toolbar/floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../floating-toolbar/types';
import {
  moveOrExtendToTrimmedCodeBoundary
} from './codemirror';

type CodeMirrorSelectionArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

class CodeBlockNodeViewKeyboardMethods {
  getArrowKey(this: any, key: string): CodeMirrorSelectionArrowKey | null {
    return key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight'
      ? key
      : null;
  }

  clearCodeMirrorSelectionArrowKey(this: any) {
    const ownerWindow = this.getOwnerWindow();
    if (ownerWindow && this.codeMirrorSelectionArrowResetTimer !== null) {
      ownerWindow.clearTimeout(this.codeMirrorSelectionArrowResetTimer);
    }
    this.codeMirrorSelectionArrowResetTimer = null;
    this.codeMirrorSelectionArrowKey = null;
  }

  rememberCodeMirrorSelectionArrowKey(this: any, event: KeyboardEvent) {
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

  shouldNormalizeCodeMirrorSelectionEdgeLineBreaks(this: any) {
    return this.codeMirrorSelectionArrowKey === 'ArrowUp' ||
      this.codeMirrorSelectionArrowKey === 'ArrowDown';
  }

  filterCodeMirrorSelectionEdgeLineBreaks(this: any,
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

  handleCodeMirrorKeydown(this: any, event: KeyboardEvent, cm: CodeMirror) {
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
