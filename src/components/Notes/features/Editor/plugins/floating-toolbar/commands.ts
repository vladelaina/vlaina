// Floating Toolbar Commands
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType, TextAlignment } from './types';
import { TOOLBAR_ACTIONS } from './types';
import { setBlockType, wrapIn, lift } from '@milkdown/kit/prose/commands';
import { floatingToolbarKey } from './floatingToolbarPlugin';
import { normalizeSerializedMarkdownSelection } from '../clipboard/markdownSerializationUtils';
import { serializeSliceToText } from '../clipboard/serializer';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';

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

export function toggleBold(view: EditorView): void {
  toggleMark(view, 'strong');
}

export function toggleItalic(view: EditorView): void {
  toggleMark(view, 'emphasis');
}

export function toggleUnderline(view: EditorView): void {
  toggleMark(view, 'underline');
}

export function toggleStrikethrough(view: EditorView): void {
  toggleMark(view, 'strike_through');
}

export function toggleCode(view: EditorView): void {
  toggleMark(view, 'inlineCode');
}

export function toggleHighlight(view: EditorView): void {
  toggleMark(view, 'highlight');
}

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

export function setTextAlignment(view: EditorView, alignment: TextAlignment): void {
  const { state, dispatch } = view;
  const { from, to, $from } = state.selection;
  const tr = state.tr;
  let updated = false;

  const isUnsupportedContainer = (typeName: string | undefined) =>
    typeName === 'table_cell' || typeName === 'table_header';

  state.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
      return;
    }

    if (isUnsupportedContainer(parent?.type.name)) {
      return false;
    }

    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      align: alignment,
    });
    updated = true;

    return false;
  });

  if (!updated) {
    const parent = $from.parent;
    const ancestor = $from.node(-1);
    if (
      (parent.type.name === 'paragraph' || parent.type.name === 'heading') &&
      !isUnsupportedContainer(ancestor.type.name)
    ) {
      const targetPos = $from.before();
      tr.setNodeMarkup(targetPos, undefined, {
        ...parent.attrs,
        align: alignment,
      });
      updated = true;
    }
  }

  if (!updated) {
    return;
  }

  dispatch(tr);
  view.focus();
}

export async function copySelectionToClipboard(view: EditorView): Promise<boolean> {
  const { from, to } = view.state.selection;
  if (from === to) {
    return false;
  }

  const text = normalizeSerializedMarkdownSelection(
    serializeSliceToText(view.state.doc.slice(from, to))
  );

  await writeTextToClipboard(text);
  view.focus();
  return true;
}

export function openLinkEditor(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: 'link' },
    })
  );
}

export function openColorPicker(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: 'color' },
    })
  );
}

export function openBlockDropdown(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: 'block' },
    })
  );
}

export function closeSubMenu(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: null },
    })
  );
}
