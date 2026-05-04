import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';

function insertNode(ctx: Ctx, nodeType: string, attrs?: object) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes[nodeType];
  if (!type) return;

  try {
    const node = type.createAndFill?.(attrs) ?? type.create(attrs);
    if (!node) return;
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
  } catch (error) {
    console.warn(`[SlashMenu] Failed to insert ${nodeType}:`, error);
  }
}

export function collectFootnoteIds(doc: { descendants?: (callback: (node: any) => void) => void }) {
  const refs = new Set<string>();
  const defs = new Set<string>();

  doc.descendants?.((node: any) => {
    const id = typeof node.attrs?.id === 'string' ? node.attrs.id.trim() : '';
    if (!id) return;

    if (node.type?.name === 'footnote_ref') {
      refs.add(id);
    } else if (node.type?.name === 'footnote_def') {
      defs.add(id);
    }
  });

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

export function getNextFootnoteRefId(doc: { descendants?: (callback: (node: any) => void) => void }) {
  const ids = collectFootnoteIds(doc);
  return getNextNumericFootnoteId([...ids.refs, ...ids.defs]);
}

export function getNextFootnoteDefId(doc: { descendants?: (callback: (node: any) => void) => void }) {
  const ids = collectFootnoteIds(doc);
  const pendingRefId = Array.from(ids.refs)
    .filter((id) => !ids.defs.has(id))
    .sort(compareFootnoteIds)[0];

  return pendingRefId ?? getNextNumericFootnoteId([...ids.refs, ...ids.defs]);
}

export function insertFootnoteRef(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  insertNode(ctx, 'footnote_ref', { id: getNextFootnoteRefId(view.state.doc) });
}

export function insertFootnoteDef(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  insertNode(ctx, 'footnote_def', { id: getNextFootnoteDefId(view.state.doc) });
}
