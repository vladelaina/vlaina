import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { consumeLeadingCalloutEmoji } from '@/components/common/markdown/calloutEmoji';
import {
  decodeCalloutIconComment,
  iconDataFromValue,
  removeLeadingCalloutIconTextMarker,
} from './calloutIconUtils';
import { markEditorUserInput } from '../shared/userInputEvents';

const MAX_CALLOUT_SHORTCUT_CHARS = 8_192;

function getCalloutMarker(text: string): { icon: string; consumedChars: number } | null {
  const markerIcon = decodeCalloutIconComment(text);
  if (markerIcon) {
    const remainingText = removeLeadingCalloutIconTextMarker(text);
    if (remainingText === null) return null;
    return { icon: markerIcon, consumedChars: text.length - remainingText.length };
  }

  const emoji = consumeLeadingCalloutEmoji(text);
  return emoji
    ? { icon: emoji.icon, consumedChars: text.length - emoji.rest.length }
    : null;
}

export function handleCalloutShortcutEnter(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty || selection.$from.depth < 2) return false;

  const paragraphType = state.schema.nodes.paragraph;
  const calloutType = state.schema.nodes.callout;
  const source = selection.$from.parent;
  if (!paragraphType || !calloutType || source.type !== paragraphType) return false;
  if (selection.$from.parentOffset !== source.content.size) return false;
  if (source.content.size > MAX_CALLOUT_SHORTCUT_CHARS) return false;

  const blockquoteDepth = selection.$from.depth - 1;
  const blockquote = selection.$from.node(blockquoteDepth);
  if (blockquote.type.name !== 'blockquote' || selection.$from.index(blockquoteDepth) !== 0) {
    return false;
  }

  const text = source.textBetween(0, source.content.size, '', '');
  const marker = getCalloutMarker(text);
  if (!marker) return false;

  const firstParagraph = paragraphType.create(
    source.attrs,
    source.content.cut(marker.consumedChars),
    source.marks,
  );
  const children = [firstParagraph];
  if (firstParagraph.content.size > 0) children.push(paragraphType.create());
  for (let index = 1; index < blockquote.childCount; index += 1) {
    children.push(blockquote.child(index));
  }

  const callout = calloutType.createAndFill({
    icon: iconDataFromValue(marker.icon),
    backgroundColor: 'yellow',
  }, children);
  if (!callout) return false;

  const parentDepth = blockquoteDepth - 1;
  const parent = selection.$from.node(parentDepth);
  const fromIndex = selection.$from.index(parentDepth);
  if (!parent.canReplaceWith(fromIndex, fromIndex + 1, calloutType, callout.marks)) {
    return false;
  }

  const from = selection.$from.before(blockquoteDepth);
  const to = selection.$from.after(blockquoteDepth);
  const tr = state.tr.replaceWith(from, to, callout);
  const cursorPos = firstParagraph.content.size > 0
    ? from + firstParagraph.nodeSize + 2
    : from + 2;
  markEditorUserInput(view);
  view.dispatch(
    tr.setSelection(TextSelection.create(tr.doc, cursorPos)).scrollIntoView(),
  );
  return true;
}
