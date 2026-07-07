import { Transaction } from '@codemirror/state';
import {
  EditorView as CodeMirror,
  type ViewUpdate
} from '@codemirror/view';
import {
  forwardCodeBlockUpdate
} from './codeBlockNodeViewUtils';

class CodeBlockNodeViewSelectionSyncMethods {
  restoreCodeMirrorSelectionAfterNativeKeyHandling(this: any,
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

  syncE2ECodeMirrorSelection(this: any) {
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

  trimCodeMirrorSelectionEdgeLineBreaks(this: any, update: ViewUpdate) {
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

  forwardUpdate(this: any, update: ViewUpdate) {
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
  }

}

function installMixinMethods(prototype: object, mixinPrototype: object): void {
  for (const key of Object.getOwnPropertyNames(mixinPrototype)) {
    if (key !== 'constructor') {
      Object.defineProperty(prototype, key, Object.getOwnPropertyDescriptor(mixinPrototype, key)!);
    }
  }
}

export function installCodeBlockNodeViewSelectionSyncMethods(prototype: object): void {
  installMixinMethods(prototype, CodeBlockNodeViewSelectionSyncMethods.prototype);
}
