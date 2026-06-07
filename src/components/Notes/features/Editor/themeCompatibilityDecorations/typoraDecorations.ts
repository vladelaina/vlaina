import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import {
  getBlockquoteAttrs,
  getFirstBlockAttrs,
  getHtmlBlockAttrs,
  getInlineHtmlAttrs,
  getListAttrs,
  getListItemAttrs,
  getPostCardChildAttrs,
  getTaskListItemAttrs,
  getVlookCaptionGapAttrs,
  getVlookCaptionTargetAttrs,
  getVlookColumnGapAttrs,
  getVlookColumnMarkerAttrs,
  getVlookColumnTargetAttrs,
  getVlookParagraphAttrs,
} from './typoraBlockAttrs';
import {
  addTyporaTableInlineDecorations,
  getTableAttrs,
  getTableCellAttrs,
} from './typoraTableSemantics';
import {
  addTyporaInlineDecorations,
  type DecorationAttrs,
} from './typoraTextSemantics';

type TyporaNodeAttrsGetter = (
  node: any,
  pos: number,
  parent: any,
  index: number | undefined
) => DecorationAttrs | null;

const TYPORA_NODE_ATTR_GETTERS: TyporaNodeAttrsGetter[] = [
  (node) => getInlineHtmlAttrs(node),
  (node) => getHtmlBlockAttrs(node),
  (node, _pos, parent, index) => getVlookColumnMarkerAttrs(node, parent, index),
  (node, _pos, parent, index) => getVlookColumnGapAttrs(node, parent, index),
  (node, _pos, parent, index) => getVlookColumnTargetAttrs(node, parent, index),
  (node, _pos, parent, index) => getVlookCaptionGapAttrs(node, parent, index),
  (node, _pos, parent, index) => getVlookCaptionTargetAttrs(node, parent, index),
  (node, _pos, _parent, index) => getFirstBlockAttrs(node, index),
  (node, pos, parent, index) => getVlookParagraphAttrs(node, pos, parent, index),
  (node, _pos, parent) => getPostCardChildAttrs(node, parent),
  (node) => getBlockquoteAttrs(node),
  (node) => getTableAttrs(node),
  (node) => getTableCellAttrs(node),
  (node) => getListAttrs(node),
  (node) => getListItemAttrs(node),
  (node) => getTaskListItemAttrs(node),
];

function pushTyporaNodeDecoration(
  decorations: Decoration[],
  node: any,
  pos: number,
  attrs: DecorationAttrs | null
) {
  if (!attrs) return;
  decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs));
}

export function buildTyporaCompatibilityDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number, parent: any, index: number | undefined) => {
    addTyporaInlineDecorations(decorations, node, pos);
    addTyporaTableInlineDecorations(decorations, node, pos);

    for (const getAttrs of TYPORA_NODE_ATTR_GETTERS) {
      pushTyporaNodeDecoration(decorations, node, pos, getAttrs(node, pos, parent, index));
    }

    return true;
  });

  return DecorationSet.create(doc, decorations);
}
