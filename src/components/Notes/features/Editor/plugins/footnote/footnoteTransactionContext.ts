import {
  isFootnoteDefinitionNodeName,
  isFootnoteReferenceNodeName,
  MAX_FOOTNOTE_DOC_SCAN_NODES,
  stepSliceContainsFootnote,
} from './footnoteScan';
import { getTransactionChangedRanges } from '../shared/transactionStepText';

export function transactionMayInsertFootnote(tr: unknown): boolean {
  const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
  return steps.some(stepSliceContainsFootnote);
}

function isFootnoteNodeName(nodeName: string | undefined): boolean {
  return Boolean(nodeName && (
    isFootnoteReferenceNodeName(nodeName)
    || isFootnoteDefinitionNodeName(nodeName)
  ));
}

function positionTouchesFootnoteNode(doc: any, pos: number): boolean {
  try {
    const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
    const resolvedPos = Math.max(0, Math.min(pos, docSize));
    const $pos = doc.resolve(resolvedPos);

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if (isFootnoteNodeName($pos.node(depth)?.type?.name)) {
        return true;
      }
    }

    return Boolean(
      isFootnoteNodeName($pos.nodeBefore?.type?.name)
      || isFootnoteNodeName($pos.nodeAfter?.type?.name)
      || isFootnoteNodeName(doc.nodeAt?.(resolvedPos)?.type?.name)
    );
  } catch {
    return false;
  }
}

function rangeTouchesFootnoteNode(doc: any, from: number, to: number): boolean {
  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
  const start = Math.max(0, Math.min(from, to, docSize));
  const end = Math.max(start, Math.min(Math.max(from, to), docSize));

  if (positionTouchesFootnoteNode(doc, start) || positionTouchesFootnoteNode(doc, end)) {
    return true;
  }
  if (end <= start || typeof doc.nodesBetween !== 'function') {
    return false;
  }

  let scanned = 0;
  let touchesFootnote = false;
  doc.nodesBetween(start, end, (node: any) => {
    scanned += 1;
    if (scanned > MAX_FOOTNOTE_DOC_SCAN_NODES) {
      touchesFootnote = true;
      return false;
    }
    if (isFootnoteNodeName(node.type?.name)) {
      touchesFootnote = true;
      return false;
    }
    return true;
  });

  return touchesFootnote;
}

export function transactionTouchesFootnoteContext(oldDoc: any, newDoc: any, tr: unknown): boolean {
  const ranges = getTransactionChangedRanges(tr);
  if (ranges.length === 0) {
    return true;
  }

  return ranges.some((range) => (
    rangeTouchesFootnoteNode(oldDoc, range.oldFrom, range.oldTo)
    || rangeTouchesFootnoteNode(newDoc, range.newFrom, range.newTo)
  ));
}
