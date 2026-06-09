import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { collapseSelectionAndHideFloatingToolbar } from '../clipboard/copyCleanup';
import { deleteSelectedBlocks } from '../cursor/blockSelectionCommands';
import {
  CLEAR_BLOCKS_ACTION,
  blankAreaDragBoxPluginKey,
  getBlockSelectionPluginState,
} from '../cursor/blockSelectionPluginState';
import { NOTES_COPY_FEEDBACK_DURATION_MS } from '../shared/copyFeedback';
import { markEditorUserInput } from '../shared/userInputEvents';
import { copySelectionToClipboard, setLink, toggleMark } from './commands';
import { floatingToolbarKey } from './floatingToolbarKey';
import { openLinkTooltipFromSelection } from './linkTooltipActions';
import { getLinkUrl } from './selectionHelpers';
import { TOOLBAR_ACTIONS, type FloatingToolbarState } from './types';

type ToolbarActionHandler = (view: EditorView) => boolean | Promise<boolean>;
type ToggleableSubMenu = 'ai' | 'color' | 'block' | 'alignment';

const COPY_FEEDBACK_SELECTION_SUPPRESS_CLASS = 'editor-toolbar-copy-feedback-active';
export const MAX_SELECTED_CODE_BLOCK_DOM_SCAN_NODES = 20_000;

type CodeBlockScanNode = {
  attrs?: { collapsed?: boolean };
  child?: (index: number) => CodeBlockScanNode;
  childCount?: number;
  content?: { size?: number };
  nodeSize?: number;
  type: { name: string };
};

function setCopyFeedbackSelectionSuppression(view: EditorView, active: boolean): void {
  view.dom.classList.toggle(COPY_FEEDBACK_SELECTION_SUPPRESS_CLASS, active);
}

export function getSelectedCodeBlockDom(view: EditorView, from: number, to: number): HTMLElement | null {
  let codeBlockDom: HTMLElement | null = null;
  const doc = view.state.doc as unknown as CodeBlockScanNode & {
    content: { size: number };
    nodesBetween?: (
      from: number,
      to: number,
      f: (node: CodeBlockScanNode, pos: number) => boolean | void,
    ) => void;
  };

  const visitNode = (node: CodeBlockScanNode, pos: number): boolean => {
    if (node.type.name !== 'code_block') {
      return false;
    }

    const contentFrom = pos + 1;
    const contentTo = pos + (node.nodeSize ?? 1) - 1;
    if (from < contentFrom || to > contentTo || node.attrs.collapsed) {
      return false;
    }

    const nodeDom = view.nodeDOM(pos);
    codeBlockDom = nodeDom instanceof HTMLElement ? nodeDom : null;
    return true;
  };

  if (typeof doc.child === 'function' && typeof doc.childCount === 'number') {
    let scanned = 0;
    const stack: Array<{
      childCount: number;
      contentStart: number;
      index: number;
      node: CodeBlockScanNode;
      offset: number;
    }> = [{
      childCount: doc.childCount,
      contentStart: 0,
      index: 0,
      node: doc,
      offset: 0,
    }];

    while (stack.length > 0 && scanned < MAX_SELECTED_CODE_BLOCK_DOM_SCAN_NODES) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.childCount) {
        stack.pop();
        continue;
      }

      const node = frame.node.child?.(frame.index);
      const pos = frame.contentStart + frame.offset;
      frame.index += 1;
      frame.offset += node?.nodeSize ?? 1;
      if (!node) continue;

      const nodeSize = node.nodeSize ?? 1;
      const nodeEnd = pos + nodeSize;
      if (nodeEnd < from) {
        continue;
      }
      if (pos > to) {
        break;
      }

      scanned += 1;
      if (visitNode(node, pos)) {
        break;
      }

      if (typeof node.child === 'function' && typeof node.childCount === 'number' && node.childCount > 0) {
        stack.push({
          childCount: node.childCount,
          contentStart: pos + 1,
          index: 0,
          node,
          offset: 0,
        });
      }
    }
  } else {
    let scanned = 0;
    doc.nodesBetween?.(from, to, (node, pos) => {
      scanned += 1;
      if (scanned > MAX_SELECTED_CODE_BLOCK_DOM_SCAN_NODES) {
        return;
      }
      if (visitNode(node, pos)) {
        return false;
      }
    });
  }

  return codeBlockDom;
}

export function focusSelectedCodeBlockAfterDelete(codeBlockDom: HTMLElement | null): boolean {
  if (!codeBlockDom?.isConnected) {
    return false;
  }

  const codeMirrorContent = codeBlockDom.querySelector<HTMLElement>('.cm-content');
  if (!codeMirrorContent) {
    return false;
  }

  codeMirrorContent.focus();
  return true;
}

function deleteSelectionRange(view: EditorView, from: number, to: number) {
  const { state } = view;
  const { selection, schema } = state;
  const paragraphType = schema.nodes.paragraph;
  const isSingleTextblock =
    selection.$from.depth === selection.$to.depth &&
    selection.$from.parent === selection.$to.parent &&
    selection.$from.parent.isTextblock;
  const isWholeTextblockSelected =
    isSingleTextblock &&
    from === selection.$from.start() &&
    to === selection.$from.end();
  const isWholeHeadingSelected =
    isWholeTextblockSelected &&
    selection.$from.parent.type.name === 'heading';

  let tr = isWholeHeadingSelected
    ? state.tr.delete(selection.$from.before(), selection.$from.after())
    : state.tr.delete(from, to);

  if (tr.doc.content.size === 0 && paragraphType) {
    tr = tr.insert(0, paragraphType.create());
  }

  const nextPos = Math.max(0, Math.min(from, tr.doc.content.size));
  tr.setSelection(TextSelection.create(tr.doc, nextPos));
  tr.setMeta(floatingToolbarKey, {
    type: TOOLBAR_ACTIONS.HIDE,
  });

  return { tr };
}

function dispatchSubMenuToggle(
  view: EditorView,
  currentState: FloatingToolbarState | null,
  nextSubMenu: ToggleableSubMenu
) {
  if (!currentState) {
    return false;
  }

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: currentState.subMenu === nextSubMenu ? null : nextSubMenu },
    })
  );
  return false;
}

export interface ToolbarActionController {
  prepareAction: (view: EditorView, action: string) => void;
  cancelPreparedAction: (action: string) => void;
  handleAction: (view: EditorView, action: string) => Promise<boolean>;
  destroy: () => void;
}

export interface ToolbarActionControllerOptions {
  onToggleSubMenu?: (
    view: EditorView,
    currentState: FloatingToolbarState | null,
    nextSubMenu: ToggleableSubMenu
  ) => boolean;
  onCloseToolbar?: (
    view: EditorView,
    currentState: FloatingToolbarState | null
  ) => boolean;
}

export function createToolbarActionController(
  getCurrentState: () => FloatingToolbarState | null,
  options: ToolbarActionControllerOptions = {}
): ToolbarActionController {
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let copyFeedbackView: EditorView | null = null;
  let preparedCopyView: EditorView | null = null;

  const clearCopyFeedbackTimer = () => {
    if (copyFeedbackTimer) {
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = null;
    }
    if (copyFeedbackView) {
      setCopyFeedbackSelectionSuppression(copyFeedbackView, false);
      copyFeedbackView = null;
    }
    preparedCopyView = null;
  };

  const beginCopyFeedbackSelectionSuppression = (view: EditorView) => {
    if (copyFeedbackTimer) {
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = null;
    }
    if (copyFeedbackView && copyFeedbackView !== view) {
      setCopyFeedbackSelectionSuppression(copyFeedbackView, false);
    }
    copyFeedbackView = view;
    setCopyFeedbackSelectionSuppression(view, true);
  };

  const cancelPreparedCopySuppression = () => {
    if (!preparedCopyView || copyFeedbackTimer) {
      preparedCopyView = null;
      return;
    }
    if (copyFeedbackView === preparedCopyView) {
      setCopyFeedbackSelectionSuppression(preparedCopyView, false);
      copyFeedbackView = null;
    }
    preparedCopyView = null;
  };

  const markActions: Record<string, string> = {
    bold: 'strong',
    italic: 'emphasis',
    underline: 'underline',
    strike: 'strike_through',
    code: 'inlineCode',
    highlight: 'highlight',
  };

  const actionHandlers: Record<string, ToolbarActionHandler> = {
    bold: (view) => {
      toggleMark(view, markActions.bold);
      return true;
    },
    italic: (view) => {
      toggleMark(view, markActions.italic);
      return true;
    },
    underline: (view) => {
      toggleMark(view, markActions.underline);
      return true;
    },
    strike: (view) => {
      toggleMark(view, markActions.strike);
      return true;
    },
    code: (view) => {
      toggleMark(view, markActions.code);
      return true;
    },
    highlight: (view) => {
      toggleMark(view, markActions.highlight);
      return true;
    },
    link: (view) => {
      const linkUrl = getLinkUrl(view);

      if (linkUrl !== null && linkUrl !== '') {
        setLink(view, null);
        return true;
      }

      openLinkTooltipFromSelection(view);
      return false;
    },
    delete: (view) => {
      const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
      if (selectedBlocks.length > 0) {
        deleteSelectedBlocks(
          view,
          selectedBlocks,
          (tr) => tr.setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION),
        );
        return false;
      }

      const { state: editorState, dispatch } = view;
      const { from, to } = editorState.selection;
      const codeBlockDom = from < to ? getSelectedCodeBlockDom(view, from, to) : null;
      if (from < to) {
        const { tr } = deleteSelectionRange(view, from, to);
        markEditorUserInput(view);
        dispatch(tr);
      }
      if (!focusSelectedCodeBlockAfterDelete(codeBlockDom)) {
        view.focus();
      }
      return false;
    },
    copy: async (view) => {
      preparedCopyView = null;
      beginCopyFeedbackSelectionSuppression(view);

      const copiedSelection = view.state.selection;
      const copiedDoc = view.state.doc;
      const copied = await copySelectionToClipboard(view, { collapseAfterCopy: false });
      if (!copied) {
        clearCopyFeedbackTimer();
        return false;
      }

      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_COPIED,
          payload: { copied: true },
        })
      );

      copyFeedbackTimer = setTimeout(() => {
        copyFeedbackTimer = null;
        if (view.state.doc.eq(copiedDoc) && copiedSelection.eq(view.state.selection)) {
          collapseSelectionAndHideFloatingToolbar(view);
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setCopyFeedbackSelectionSuppression(view, false);
            if (copyFeedbackView === view) {
              copyFeedbackView = null;
            }
          });
        });
      }, NOTES_COPY_FEEDBACK_DURATION_MS);
      return false;
    },
    ai: (view) => {
      const currentState = getCurrentState();
      return options.onToggleSubMenu?.(view, currentState, 'ai')
        ?? dispatchSubMenuToggle(view, currentState, 'ai');
    },
    color: (view) => {
      const currentState = getCurrentState();
      return options.onToggleSubMenu?.(view, currentState, 'color')
        ?? dispatchSubMenuToggle(view, currentState, 'color');
    },
    block: (view) => {
      const currentState = getCurrentState();
      return options.onToggleSubMenu?.(view, currentState, 'block')
        ?? dispatchSubMenuToggle(view, currentState, 'block');
    },
    alignment: (view) => {
      const currentState = getCurrentState();
      return options.onToggleSubMenu?.(view, currentState, 'alignment')
        ?? dispatchSubMenuToggle(view, currentState, 'alignment');
    },
  };

  return {
    prepareAction(view, action) {
      if (action === 'copy') {
        preparedCopyView = view;
        beginCopyFeedbackSelectionSuppression(view);
      }
    },
    cancelPreparedAction(action) {
      if (action === 'copy') {
        cancelPreparedCopySuppression();
      }
    },
    async handleAction(view, action) {
      const handler = actionHandlers[action];
      if (!handler) {
        return false;
      }

      return handler(view);
    },
    destroy() {
      clearCopyFeedbackTimer();
    },
  };
}
