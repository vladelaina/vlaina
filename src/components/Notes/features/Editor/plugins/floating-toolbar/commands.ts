// Floating Toolbar Commands
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { setBlockType, wrapIn, lift } from '@milkdown/kit/prose/commands';
import { floatingToolbarKey } from './floatingToolbarPlugin';

/**
 * Toggle a mark on the current selection
 */
export function toggleMark(view: EditorView, markName: string): void {
  const { state, dispatch } = view;
  const markType = state.schema.marks[markName];
  if (!markType) return;

  const { from, to } = state.selection;
  const hasMark = state.doc.rangeHasMark(from, to, markType);

  if (hasMark) {
    dispatch(state.tr.removeMark(from, to, markType));
  } else {
    dispatch(state.tr.addMark(from, to, markType.create()));
  }

  view.focus();
}

/**
 * Toggle bold format
 */
export function toggleBold(view: EditorView): void {
  toggleMark(view, 'strong');
}

/**
 * Toggle italic format
 */
export function toggleItalic(view: EditorView): void {
  toggleMark(view, 'emphasis');
}

/**
 * Toggle underline format
 */
export function toggleUnderline(view: EditorView): void {
  toggleMark(view, 'underline');
}

/**
 * Toggle strikethrough format
 */
export function toggleStrikethrough(view: EditorView): void {
  toggleMark(view, 'strike_through');
}

/**
 * Toggle inline code format
 */
export function toggleCode(view: EditorView): void {
  toggleMark(view, 'inlineCode');
}

/**
 * Toggle highlight format
 */
export function toggleHighlight(view: EditorView): void {
  toggleMark(view, 'highlight');
}

/**
 * Set link on selection
 */
export function setLink(view: EditorView, url: string | null): void {
  const { state, dispatch } = view;
  const { from, to } = state.selection;
  const linkMark = state.schema.marks.link;

  if (!linkMark) return;

  if (url !== null) {
    dispatch(state.tr.addMark(from, to, linkMark.create({ href: url })));
  } else {
    dispatch(state.tr.removeMark(from, to, linkMark));
  }

  view.focus();
}

/**
 * Set text color on selection
 */
export function setTextColor(view: EditorView, color: string | null): void {
  const { state, dispatch } = view;
  const { from, to } = state.selection;
  const colorMark = state.schema.marks.textColor;

  if (!colorMark) return;

  if (color) {
    dispatch(state.tr.addMark(from, to, colorMark.create({ color })));
  } else {
    dispatch(state.tr.removeMark(from, to, colorMark));
  }

  view.focus();
}

/**
 * Set background color on selection
 */
export function setBgColor(view: EditorView, color: string | null): void {
  const { state, dispatch } = view;
  const { from, to } = state.selection;
  const colorMark = state.schema.marks.bgColor;

  if (!colorMark) return;

  if (color) {
    dispatch(state.tr.addMark(from, to, colorMark.create({ color })));
  } else {
    dispatch(state.tr.removeMark(from, to, colorMark));
  }

  view.focus();
}

/**
 * Convert block to specified type
 */
export function convertBlockType(view: EditorView, blockType: BlockType): void {
  const { state, dispatch } = view;
  const { $from } = state.selection;

  switch (blockType) {
    case 'paragraph': {
      const paragraphType = state.schema.nodes.paragraph;
      if (paragraphType) {
        setBlockType(paragraphType)(state, dispatch);
      }
      break;
    }

    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6': {
      const level = parseInt(blockType.replace('heading', ''));
      const headingType = state.schema.nodes.heading;
      if (headingType) {
        setBlockType(headingType, { level })(state, dispatch);
      }
      break;
    }

    case 'blockquote': {
      const blockquoteType = state.schema.nodes.blockquote;
      if (blockquoteType) {
        // Check if already in blockquote
        const parent = $from.node(-1);
        if (parent && parent.type.name === 'blockquote') {
          lift(state, dispatch);
        } else {
          wrapIn(blockquoteType)(state, dispatch);
        }
      }
      break;
    }

    case 'bulletList': {
      const bulletListType = state.schema.nodes.bullet_list;
      const listItemType = state.schema.nodes.list_item;
      if (bulletListType && listItemType) {
        wrapIn(bulletListType)(state, dispatch);
      }
      break;
    }

    case 'orderedList': {
      const orderedListType = state.schema.nodes.ordered_list;
      if (orderedListType) {
        wrapIn(orderedListType)(state, dispatch);
      }
      break;
    }

    case 'taskList': {
      // Task list handling depends on schema
      const taskListType = state.schema.nodes.task_list;
      if (taskListType) {
        wrapIn(taskListType)(state, dispatch);
      }
      break;
    }

    case 'codeBlock': {
      const codeBlockType = state.schema.nodes.code_block;
      if (codeBlockType) {
        setBlockType(codeBlockType)(state, dispatch);
      }
      break;
    }
  }

  view.focus();
}

/**
 * Open link editor submenu
 */
export function openLinkEditor(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: 'link' },
    })
  );
}

/**
 * Open color picker submenu
 */
export function openColorPicker(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: 'color' },
    })
  );
}

/**
 * Open block type dropdown
 */
export function openBlockDropdown(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: 'block' },
    })
  );
}

/**
 * Close any open submenu
 */
export function closeSubMenu(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: null },
    })
  );
}