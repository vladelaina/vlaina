import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { canShowSelectionAiTools } from './aiAvailability';
import { copySelectionToClipboard, setLink, toggleMark } from './commands';
import { floatingToolbarKey } from './floatingToolbarKey';
import { openLinkTooltipFromSelection } from './linkTooltipActions';
import { getLinkUrl } from './selectionHelpers';
import { TOOLBAR_ACTIONS, type FloatingToolbarState } from './types';

type ToolbarActionHandler = (view: EditorView) => boolean | Promise<boolean>;

function getSelectedCodeBlockDom(view: EditorView, from: number, to: number): HTMLElement | null {
  let codeBlockDom: HTMLElement | null = null;

  view.state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== 'code_block') {
      return;
    }

    const contentFrom = pos + 1;
    const contentTo = pos + node.nodeSize - 1;
    if (from < contentFrom || to > contentTo || node.attrs.collapsed) {
      return false;
    }

    const nodeDom = view.nodeDOM(pos);
    codeBlockDom = nodeDom instanceof HTMLElement ? nodeDom : null;
    return false;
  });

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
  nextSubMenu: 'ai' | 'color' | 'block' | 'alignment'
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
  handleAction: (view: EditorView, action: string) => Promise<boolean>;
  destroy: () => void;
}

export function createToolbarActionController(
  getCurrentState: () => FloatingToolbarState | null
): ToolbarActionController {
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

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
      const { state: editorState, dispatch } = view;
      const { from, to } = editorState.selection;
      const codeBlockDom = from < to ? getSelectedCodeBlockDom(view, from, to) : null;
      if (from < to) {
        const { tr } = deleteSelectionRange(view, from, to);
        dispatch(tr);
      }
      if (!focusSelectedCodeBlockAfterDelete(codeBlockDom)) {
        view.focus();
      }
      return false;
    },
    copy: async (view) => {
      const copied = await copySelectionToClipboard(view);
      if (!copied) {
        return false;
      }

      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_COPIED,
          payload: { copied: true },
        })
      );

      if (copyFeedbackTimer) {
        clearTimeout(copyFeedbackTimer);
      }

      copyFeedbackTimer = setTimeout(() => {
        copyFeedbackTimer = null;
        view.dispatch(
          view.state.tr.setMeta(floatingToolbarKey, {
            type: TOOLBAR_ACTIONS.SET_COPIED,
            payload: { copied: false },
          })
        );
      }, 1200);
      return true;
    },
    ai: (view) => {
      if (!canShowSelectionAiTools()) {
        return false;
      }

      return dispatchSubMenuToggle(view, getCurrentState(), 'ai');
    },
    color: (view) => dispatchSubMenuToggle(view, getCurrentState(), 'color'),
    block: (view) => dispatchSubMenuToggle(view, getCurrentState(), 'block'),
    alignment: (view) => dispatchSubMenuToggle(view, getCurrentState(), 'alignment'),
  };

  return {
    async handleAction(view, action) {
      const handler = actionHandlers[action];
      if (!handler) {
        return false;
      }

      return handler(view);
    },
    destroy() {
      if (copyFeedbackTimer) {
        clearTimeout(copyFeedbackTimer);
        copyFeedbackTimer = null;
      }
    },
  };
}
