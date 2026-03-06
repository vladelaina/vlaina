import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { shouldConvertLineToThematicBreak } from './hrAutoParagraphUtils';

export const hrAutoParagraphPluginKey = new PluginKey('hrAutoParagraph');

function shouldConvertToHorizontalRule(view: EditorView, from: number, to: number, text: string): boolean {
  if (from !== to) return false;

  const { state } = view;
  const { selection } = state;
  if (!selection.empty || selection.from !== from) return false;

  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType || selection.$from.parent.type !== paragraphType) return false;

  const parent = selection.$from.parent;
  const offset = selection.$from.parentOffset;
  return shouldConvertLineToThematicBreak(parent.textContent, offset, text);
}

function insertHorizontalRuleWithTrailingParagraph(view: EditorView): boolean {
  const { state } = view;
  const hrType = state.schema.nodes.hr;
  const paragraphType = state.schema.nodes.paragraph;
  if (!hrType || !paragraphType) return false;

  const { $from } = state.selection;
  const paragraphPos = $from.before();
  const paragraphNodeSize = $from.parent.nodeSize;

  const hrNode = hrType.create();
  let tr = state.tr.replaceWith(paragraphPos, paragraphPos + paragraphNodeSize, hrNode);
  const afterHrPos = paragraphPos + hrNode.nodeSize;

  tr = tr.insert(afterHrPos, paragraphType.create());
  tr = tr.setSelection(TextSelection.create(tr.doc, afterHrPos + 1)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

export const hrAutoParagraphPlugin = $prose(() => {
  return new Plugin({
    key: hrAutoParagraphPluginKey,
    props: {
      handleTextInput(view, from, to, text) {
        if (!shouldConvertToHorizontalRule(view, from, to, text)) return false;
        return insertHorizontalRuleWithTrailingParagraph(view);
      },
    },
  });
});
