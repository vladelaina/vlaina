import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import {
  MAX_FOOTNOTE_DOC_SCAN_NODES,
  isFootnoteDefinitionNodeName,
  isFootnoteReferenceNodeName,
} from '../footnote/footnoteScan';

export const MAX_SLASH_FOOTNOTE_ID_SCAN_NODES = MAX_FOOTNOTE_DOC_SCAN_NODES;
export const MAX_SLASH_FOOTNOTE_IDS = 5000;

interface FootnoteIdScanNode {
  attrs?: Record<string, unknown>;
  child?: (index: number) => FootnoteIdScanNode | null | undefined;
  childCount?: number;
  descendants?: (callback: (node: FootnoteIdScanNode) => boolean | void) => void;
  type?: { name?: string };
}

function markSlashUserInput(view: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  view.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

function insertNode(ctx: Ctx, nodeType: string, attrs?: object) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes[nodeType];
  if (!type) return;

  try {
    const node = type.createAndFill?.(attrs) ?? type.create(attrs);
    if (!node) return;
    markSlashUserInput(view);
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
  } catch (error) {
  }
}

function getFootnoteRefNodeSpec(ctx: Ctx, id: string) {
  const nodes = ctx.get(editorViewCtx).state.schema.nodes;
  return nodes.footnote_reference
    ? { nodeType: 'footnote_reference', attrs: { label: id } }
    : { nodeType: 'footnote_ref', attrs: { id } };
}

function getFootnoteDefNodeSpec(ctx: Ctx, id: string) {
  const nodes = ctx.get(editorViewCtx).state.schema.nodes;
  return nodes.footnote_definition
    ? { nodeType: 'footnote_definition', attrs: { label: id } }
    : { nodeType: 'footnote_def', attrs: { id } };
}

function getFootnoteScanChildCount(node: FootnoteIdScanNode): number {
  return typeof node.childCount === 'number' && Number.isFinite(node.childCount) && node.childCount > 0
    ? Math.floor(node.childCount)
    : 0;
}

function addFootnoteId(
  node: FootnoteIdScanNode,
  refs: Set<string>,
  defs: Set<string>,
  maxIds: number
): boolean {
  const rawId = typeof node.attrs?.id === 'string' ? node.attrs.id : node.attrs?.label;
  const id = typeof rawId === 'string' ? rawId.trim() : '';
  if (!id) return false;

  const nodeName = node.type?.name ?? '';
  if (isFootnoteReferenceNodeName(nodeName)) {
    refs.add(id);
  } else if (isFootnoteDefinitionNodeName(nodeName)) {
    defs.add(id);
  }

  return refs.size + defs.size >= maxIds;
}

function scanFootnoteIdNodes(
  doc: FootnoteIdScanNode,
  refs: Set<string>,
  defs: Set<string>,
  maxNodes: number,
  maxIds: number
): void {
  if (typeof doc.child === 'function') {
    let scanned = 0;
    const stack: Array<{ node: FootnoteIdScanNode; index: number; childCount: number }> = [{
      node: doc,
      index: 0,
      childCount: getFootnoteScanChildCount(doc),
    }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.childCount) {
        stack.pop();
        continue;
      }

      if (scanned >= maxNodes) return;

      const node = frame.node.child?.(frame.index);
      frame.index += 1;
      if (!node) continue;

      scanned += 1;
      if (addFootnoteId(node, refs, defs, maxIds)) return;

      const childCount = getFootnoteScanChildCount(node);
      if (childCount > 0 && typeof node.child === 'function') {
        stack.push({ node, index: 0, childCount });
      }
    }
    return;
  }

  let scanned = 0;
  let stopped = false;
  doc.descendants?.((node) => {
    if (stopped) return false;
    if (scanned >= maxNodes) {
      stopped = true;
      return false;
    }

    scanned += 1;
    if (addFootnoteId(node, refs, defs, maxIds)) {
      stopped = true;
      return false;
    }
    return true;
  });
}

export function collectFootnoteIds(
  doc: FootnoteIdScanNode,
  maxNodes = MAX_SLASH_FOOTNOTE_ID_SCAN_NODES,
  maxIds = MAX_SLASH_FOOTNOTE_IDS
) {
  const refs = new Set<string>();
  const defs = new Set<string>();

  scanFootnoteIdNodes(doc, refs, defs, maxNodes, maxIds);

  return { refs, defs };
}

function getNextNumericFootnoteId(ids: Iterable<string>) {
  let maxId = 0;
  for (const id of ids) {
    const numericId = Number.parseInt(id, 10);
    if (Number.isInteger(numericId) && String(numericId) === id) {
      maxId = Math.max(maxId, numericId);
    }
  }
  return String(maxId + 1);
}

function compareFootnoteIds(a: string, b: string) {
  const aNumber = Number.parseInt(a, 10);
  const bNumber = Number.parseInt(b, 10);
  const aIsNumeric = Number.isInteger(aNumber) && String(aNumber) === a;
  const bIsNumeric = Number.isInteger(bNumber) && String(bNumber) === b;

  if (aIsNumeric && bIsNumeric) {
    return aNumber - bNumber;
  }

  if (aIsNumeric !== bIsNumeric) {
    return aIsNumeric ? -1 : 1;
  }

  return a.localeCompare(b);
}

export function getNextFootnoteRefId(doc: FootnoteIdScanNode) {
  const ids = collectFootnoteIds(doc);
  return getNextNumericFootnoteId([...ids.refs, ...ids.defs]);
}

export function getNextFootnoteDefId(doc: FootnoteIdScanNode) {
  const ids = collectFootnoteIds(doc);
  const pendingRefId = Array.from(ids.refs)
    .filter((id) => !ids.defs.has(id))
    .sort(compareFootnoteIds)[0];

  return pendingRefId ?? getNextNumericFootnoteId([...ids.refs, ...ids.defs]);
}

export function insertFootnoteRef(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const spec = getFootnoteRefNodeSpec(ctx, getNextFootnoteRefId(view.state.doc));
  insertNode(ctx, spec.nodeType, spec.attrs);
}

export function insertFootnoteDef(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const spec = getFootnoteDefNodeSpec(ctx, getNextFootnoteDefId(view.state.doc));
  insertNode(ctx, spec.nodeType, spec.attrs);
}
