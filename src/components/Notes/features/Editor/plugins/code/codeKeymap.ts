import { $prose } from '@milkdown/kit/utils';
import { keymap } from '@milkdown/kit/prose/keymap';
import { Plugin } from '@milkdown/kit/prose/state';
import {
  isClickInBottomBlankSpace,
  moveSelectionAfterNode,
} from './codeBlockSelectionUtils';
import {
  handleCodeBlockEnter,
  handleEmptyCodeBlockBackspace,
  moveCursorAfterCodeBlock,
} from './codeKeymapUtils';

export const codeEnterKeymap = $prose(() => {
  return keymap({
    ArrowDown: (state, dispatch) => {
      return moveCursorAfterCodeBlock(state, dispatch);
    },
    Enter: (state, dispatch) => {
      return handleCodeBlockEnter(state, dispatch);
    },
    Backspace: (state, dispatch) => {
      return handleEmptyCodeBlockBackspace(state, dispatch);
    },
  });
});

export const codeBlockBlankAreaClickPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (!(event instanceof MouseEvent)) return false;
          if (event.target !== view.dom) return false;

          const root = view.dom as HTMLElement;
          if (!isClickInBottomBlankSpace(root, event.clientY)) return false;

          const tr = view.state.tr;
          const doc = tr.doc;
          const lastNode = doc.lastChild;
          const docEnd = doc.content.size;

          if (lastNode?.type.name !== 'code_block') return false;
          moveSelectionAfterNode(tr, docEnd - lastNode.nodeSize, lastNode.nodeSize);

          view.dispatch(tr.scrollIntoView());
          view.focus();
          event.preventDefault();
          return true;
        },
      },
    },
  });
});

export const codeBlockPlugins = [codeEnterKeymap, codeBlockBlankAreaClickPlugin];
