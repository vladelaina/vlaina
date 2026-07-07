import { TextSelection } from '@milkdown/kit/prose/state';
import {
  buildCodeMirrorFindHighlightRanges,
  syncCodeMirrorFindHighlights
} from '../find/editorFindCodeMirrorHighlights';
import { getEditorFindState } from '../find/editorFindCommands';
import { FOCUSED_CODE_BLOCK_FORWARD_DEBOUNCE_MS } from './CodeBlockNodeViewConstants';
import { codeBlockLanguageLoader } from './codeBlockLanguageLoader';
import {
  applyCodeBlockCollapsedState
} from './codeBlockNodeViewUtils';
import {
  computeCodeBlockChange,
  mapCodeBlockEditorOffsetToDocumentOffset,
  mapDocumentOffsetToCodeBlockEditorOffset,
  normalizeCodeBlockEditorText
} from './codemirror';

class CodeBlockNodeViewStateMethods {
  scheduleForwardFocusedCodeMirrorSnapshot(this: any) {
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

  clearPendingForwardUpdate(this: any) {
    const window = this.getOwnerWindow();
    if (window && this.pendingForwardTimer !== null) {
      window.clearTimeout(this.pendingForwardTimer);
    }
    this.pendingForwardTimer = null;
  }

  forwardFocusedCodeMirrorSnapshot(this: any) {
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

  syncCollapsedState(this: any) {
    const nextCollapsedState = Boolean(this.node.attrs.collapsed);
    if (nextCollapsedState === this.collapsedState) {
      return;
    }

    this.collapsedState = nextCollapsedState;
    applyCodeBlockCollapsedState(this.dom, this.editorDOM, nextCollapsedState);
    this.scheduleMeasure();
  }

  syncFindHighlights(this: any) {
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

  syncFindHighlightRanges(this: any, ranges: ReturnType<typeof buildCodeMirrorFindHighlightRanges>) {
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

  clearMirroredOuterSelection(this: any) {
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

  scheduleMeasure(this: any) {
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

  async syncLanguage(this: any) {
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
