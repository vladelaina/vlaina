import { lift, wrapIn } from '@milkdown/kit/prose/commands';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType, TextAlignment } from './types';
import {
  convertToList,
  convertToTextBlock,
  normalizeCurrentBlockToParagraph,
} from './blockTypeConversion';

export function convertBlockType(view: EditorView, blockType: BlockType): void {
  const { state, dispatch } = view;
  const { $from } = state.selection;

  switch (blockType) {
    case 'paragraph': {
      const paragraphType = state.schema.nodes.paragraph;
      if (paragraphType) {
        convertToTextBlock(view, paragraphType);
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
        convertToTextBlock(view, headingType, { level });
      }
      break;
    }

    case 'blockquote': {
      const blockquoteType = state.schema.nodes.blockquote;
      if (blockquoteType) {
        const parent = $from.node(-1);
        if (parent && parent.type.name === 'blockquote') {
          lift(state, dispatch);
        } else {
          normalizeCurrentBlockToParagraph(view, { unwrapListItem: true });
          wrapIn(blockquoteType)(view.state, view.dispatch);
        }
      }
      break;
    }

    case 'bulletList': {
      const bulletListType = state.schema.nodes.bullet_list;
      if (bulletListType) {
        convertToList(view, bulletListType);
      }
      break;
    }

    case 'orderedList': {
      const orderedListType = state.schema.nodes.ordered_list;
      if (orderedListType) {
        convertToList(view, orderedListType);
      }
      break;
    }

    case 'taskList': {
      const bulletListType = state.schema.nodes.bullet_list;
      if (bulletListType) {
        convertToList(view, bulletListType, { checked: false });
      }
      break;
    }

    case 'codeBlock': {
      const codeBlockType = state.schema.nodes.code_block;
      if (codeBlockType) {
        convertToTextBlock(view, codeBlockType);
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
