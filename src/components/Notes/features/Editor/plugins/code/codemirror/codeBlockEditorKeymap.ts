import * as proseState from '@milkdown/kit/prose/state';
import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { EditorView as CodeMirror, KeyBinding } from '@codemirror/view';
import { exitCode } from '@milkdown/kit/prose/commands';
import { redo, undo } from '@milkdown/kit/prose/history';

const { TextSelection } = proseState;
const AllSelection = (
  proseState as typeof proseState & {
    AllSelection: (new (doc: unknown) => unknown) & {
      create?: (doc: unknown) => unknown;
    };
  }
).AllSelection;

type CreateCodeBlockKeymapOptions = {
  getCodeMirror: () => CodeMirror | undefined;
  view: EditorView;
  getNode: () => Node;
  getPos: () => number | undefined;
};

function createAllSelection(doc: unknown) {
  if (typeof AllSelection.create === 'function') {
    return AllSelection.create(doc);
  }

  return new AllSelection(doc);
}

function isEntireDocumentSelected(cm: CodeMirror): boolean {
  const selection = cm.state.selection.main;
  return selection.from === 0 && selection.to === cm.state.doc.length;
}

function maybeEscape(
  getCodeMirror: () => CodeMirror | undefined,
  view: EditorView,
  getNode: () => Node,
  getPos: () => number | undefined,
  unit: 'line' | 'char',
  direction: -1 | 1
) {
  const cm = getCodeMirror();
  if (!cm) {
    return false;
  }

  const { state } = cm;
  const selection = state.selection.main;
  if (!selection.empty) {
    return false;
  }

  const range = unit === 'line' ? state.doc.lineAt(selection.head) : selection;

  if (direction < 0 ? range.from > 0 : range.to < state.doc.length) {
    return false;
  }

  const pos = getPos();
  if (pos === undefined) {
    return false;
  }

  const node = getNode();
  const targetPos = pos + (direction < 0 ? 0 : node.nodeSize);
  const nextSelection = TextSelection.near(view.state.doc.resolve(targetPos), direction);
  view.dispatch(view.state.tr.setSelection(nextSelection).scrollIntoView());
  view.focus();
  return true;
}

export function createCodeBlockEditorKeymap({
  getCodeMirror,
  view,
  getNode,
  getPos,
}: CreateCodeBlockKeymapOptions): KeyBinding[] {
  return [
    {
      key: 'Mod-a',
      run: () => {
        const cm = getCodeMirror();
        if (!cm) {
          return false;
        }

        if (isEntireDocumentSelected(cm)) {
          view.dispatch(view.state.tr.setSelection(createAllSelection(view.state.doc) as never));
          view.focus();
          return true;
        }

        cm.dispatch({
          selection: {
            anchor: 0,
            head: cm.state.doc.length,
          },
        });
        cm.focus();
        return true;
      },
    },
    { key: 'ArrowUp', run: () => maybeEscape(getCodeMirror, view, getNode, getPos, 'line', -1) },
    { key: 'ArrowLeft', run: () => maybeEscape(getCodeMirror, view, getNode, getPos, 'char', -1) },
    { key: 'ArrowDown', run: () => maybeEscape(getCodeMirror, view, getNode, getPos, 'line', 1) },
    { key: 'ArrowRight', run: () => maybeEscape(getCodeMirror, view, getNode, getPos, 'char', 1) },
    {
      key: 'Mod-Enter',
      run: () => {
        if (!exitCode(view.state, view.dispatch)) {
          return false;
        }

        view.focus();
        return true;
      },
    },
    { key: 'Mod-z', run: () => undo(view.state, view.dispatch) },
    { key: 'Shift-Mod-z', run: () => redo(view.state, view.dispatch) },
    { key: 'Mod-y', run: () => redo(view.state, view.dispatch) },
    {
      key: 'Backspace',
      run: () => {
        const cm = getCodeMirror();
        if (!cm) {
          return false;
        }

        const ranges = cm.state.selection.ranges;
        if (ranges.length !== 1) {
          return false;
        }

        const selection = ranges[0];
        if (!selection.empty || selection.anchor > 0 || cm.state.doc.lines >= 2) {
          return false;
        }

        const pos = getPos();
        if (pos === undefined) {
          return false;
        }

        const paragraph = view.state.schema.nodes.paragraph;
        if (!paragraph) {
          return false;
        }

        const node = getNode();
        const paragraphContent = node.textContent
          ? view.state.schema.text(node.textContent)
          : undefined;
        const tr = view.state.tr.replaceWith(
          pos,
          pos + node.nodeSize,
          paragraph.create(null, paragraphContent)
        );

        tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
        view.dispatch(tr);
        view.focus();
        return true;
      },
    },
  ];
}
