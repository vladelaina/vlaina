import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import {
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../../../plugins/shared/boundedProseNodeScan';
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
  index: number | undefined,
  taskListCache: WeakMap<object, boolean>
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
  (node, _pos, _parent, _index, taskListCache) => getListAttrs(node, taskListCache),
  (node) => getListItemAttrs(node),
  (node) => getTaskListItemAttrs(node),
];

export interface TyporaCompatibilityDecorationOptions {
  maxDecorations: number;
  maxScanNodes: number;
}

function pushTyporaNodeDecoration(
  decorations: Decoration[],
  node: any,
  pos: number,
  attrs: DecorationAttrs | null,
  maxDecorations: number
): boolean {
  if (!attrs) return decorations.length < maxDecorations;
  if (decorations.length >= maxDecorations) return false;

  decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs));
  return decorations.length < maxDecorations;
}

export function buildTyporaCompatibilityDecorations(
  doc: any,
  options: TyporaCompatibilityDecorationOptions
): DecorationSet {
  const decorations: Decoration[] = [];
  const taskListCache = new WeakMap<object, boolean>();

  scanProseDescendants(doc, (node: any, pos: number, parent: any, index: number | undefined) => {
    if (decorations.length >= options.maxDecorations) return STOP_PROSE_SCAN;

    const beforeInlineDecorations = decorations.length;
    addTyporaInlineDecorations(decorations, node, pos);
    addTyporaTableInlineDecorations(decorations, node, pos);
    if (decorations.length > options.maxDecorations) {
      decorations.splice(options.maxDecorations);
      return STOP_PROSE_SCAN;
    }
    const inlineDecorationCount = decorations.length - beforeInlineDecorations;
    if (inlineDecorationCount > 0 && decorations.length >= options.maxDecorations) {
      return STOP_PROSE_SCAN;
    }

    for (const getAttrs of TYPORA_NODE_ATTR_GETTERS) {
      const attrs = getAttrs(node, pos, parent, index, taskListCache);
      if (!pushTyporaNodeDecoration(decorations, node, pos, attrs, options.maxDecorations)) {
        return STOP_PROSE_SCAN;
      }
    }

    return true;
  }, options.maxScanNodes);

  return DecorationSet.create(doc, decorations);
}
