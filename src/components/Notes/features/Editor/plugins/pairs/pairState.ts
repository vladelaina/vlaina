import { PluginKey } from '@milkdown/kit/prose/state';

import { closePairSpecs, openPairSpecs } from './pairSpecs';

export type AutoInsertedCloser = {
  close: string;
  pos: number;
};

type PairStateMeta =
  | { type: 'add-auto-closers'; entries: AutoInsertedCloser[] };

export const autoPairPluginKey = new PluginKey<AutoInsertedCloser[]>('autoPair');

const HISTORY_META_KEY = 'history$';

type DocLike = {
  content: { size: number };
  textBetween: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
};

type SelectionLike = {
  empty: boolean;
  from: number;
  $from: {
    parent: {
      isTextblock: boolean;
      textContent: string;
    };
    parentOffset: number;
  };
};

type EditorStateLike = {
  doc: DocLike;
  selection: SelectionLike;
};

type MappingLike = {
  map: (pos: number, assoc?: number) => number;
  mapResult?: (pos: number, assoc?: number) => { pos: number; deleted: boolean };
};

type TransactionLike = {
  docChanged: boolean;
  getMeta?: (key: string | PluginKey<AutoInsertedCloser[]>) => unknown;
  mapping: MappingLike;
};

function isHistoryTransaction(tr: { getMeta?: (key: string) => unknown }): boolean {
  return tr.getMeta?.(HISTORY_META_KEY) != null;
}

function isPairStateMeta(value: unknown): value is PairStateMeta {
  if (!value || typeof value !== 'object') return false;
  const meta = value as Partial<PairStateMeta>;
  if (meta.type !== 'add-auto-closers' || !Array.isArray(meta.entries)) return false;
  return meta.entries.every((entry) =>
    entry &&
    typeof entry === 'object' &&
    typeof (entry as AutoInsertedCloser).close === 'string' &&
    typeof (entry as AutoInsertedCloser).pos === 'number',
  );
}

function getDocCharAt(
  doc: DocLike,
  pos: number,
): string {
  if (pos < 0 || pos >= doc.content.size) return '';
  return doc.textBetween(pos, pos + 1, '', '');
}

function findMatchingOpenOffset(
  text: string,
  closeOffset: number,
  rangeStart: number,
): number {
  const close = text[closeOffset];
  const spec = closePairSpecs.get(close);
  if (!spec || spec.symmetric) return -1;

  let depth = 0;

  for (let offset = closeOffset - 1; offset >= rangeStart; offset -= 1) {
    const char = text[offset];
    if (char === close) {
      depth += 1;
      continue;
    }

    if (char !== spec.open) continue;
    if (depth === 0) return offset;
    depth -= 1;
  }

  return -1;
}

function recoverTrailingNestedClosers(
  text: string,
  textStart: number,
  rangeStart: number,
  rangeEnd: number,
): AutoInsertedCloser[] {
  if (rangeEnd <= rangeStart) return [];

  const closeOffset = rangeEnd - 1;
  const openOffset = findMatchingOpenOffset(text, closeOffset, rangeStart);
  if (openOffset < 0) return [];

  return [
    ...recoverTrailingNestedClosers(text, textStart, openOffset + 1, closeOffset),
    { close: text[closeOffset], pos: textStart + closeOffset },
  ];
}

function mapAutoInsertedClosers(
  entries: AutoInsertedCloser[],
  tr: TransactionLike,
  newDoc: DocLike,
): AutoInsertedCloser[] {
  const mapped = tr.docChanged
    ? entries.flatMap((entry) => {
        const result = tr.mapping.mapResult
          ? tr.mapping.mapResult(entry.pos, 1)
          : { pos: tr.mapping.map(entry.pos, 1), deleted: false };
        if (result.deleted) return [];
        return [{ ...entry, pos: result.pos }];
      })
    : entries;

  const nextEntries = mapped.filter((entry) => {
    if (!closePairSpecs.has(entry.close)) return false;
    return getDocCharAt(newDoc, entry.pos) === entry.close;
  });

  const deduped = new Map<string, AutoInsertedCloser>();
  nextEntries.forEach((entry) => {
    deduped.set(`${entry.pos}:${entry.close}`, entry);
  });

  return Array.from(deduped.values()).sort((a, b) => a.pos - b.pos);
}

function recoverSelectionAutoCloser(
  newState: EditorStateLike,
): AutoInsertedCloser[] {
  if (!newState.selection.empty) return [];

  const { $from, from } = newState.selection;
  if (!$from.parent.isTextblock) return [];
  const text = $from.parent.textContent;
  const entries: AutoInsertedCloser[] = [];
  const textStart = from - $from.parentOffset;

  if ($from.parentOffset < text.length) {
    const close = text[$from.parentOffset];
    if (closePairSpecs.has(close)) {
      const openOffset = findMatchingOpenOffset(text, $from.parentOffset, 0);
      if (openOffset >= 0) {
        entries.push({ close, pos: from });
      } else if ($from.parentOffset > 0) {
        const open = text[$from.parentOffset - 1];
        const spec = openPairSpecs.get(open);
        if (spec?.close === close) {
          entries.push({ close, pos: from });
        }
      }
    }
  }

  if ($from.parentOffset > 0) {
    const previousChar = text[$from.parentOffset - 1];
    if (closePairSpecs.has(previousChar)) {
      entries.push({ close: previousChar, pos: from - 1 });
    }

    entries.push(
      ...recoverTrailingNestedClosers(text, textStart, 0, $from.parentOffset),
    );
  }

  return entries;
}

function recoverHistoryAutoCloser(
  tr: TransactionLike,
  newState: EditorStateLike,
): AutoInsertedCloser[] {
  if (!isHistoryTransaction(tr)) return [];
  return recoverSelectionAutoCloser(newState);
}

export function getAutoInsertedClosers(state: {
  doc: DocLike;
}): AutoInsertedCloser[] {
  return autoPairPluginKey.getState(state as never) ?? [];
}

export function hasAutoInsertedCloserAt(
  state: {
    doc: DocLike;
  },
  pos: number,
  close: string,
): boolean {
  return getAutoInsertedClosers(state).some((entry) => entry.pos === pos && entry.close === close);
}

export function createAddAutoClosersMeta(entries: AutoInsertedCloser[]): PairStateMeta {
  return { type: 'add-auto-closers', entries };
}

export function findRecoverableAutoCloserFromSelection(state: {
  selection: SelectionLike;
}): AutoInsertedCloser | null {
  const { selection } = state;
  if (!selection.empty) return null;

  const { $from, from } = selection;
  if (!$from.parent.isTextblock) return null;

  const text = $from.parent.textContent;
  for (let offset = $from.parentOffset; offset < text.length; offset += 1) {
    const close = text[offset];
    if (!closePairSpecs.has(close)) continue;

    const openOffset = findMatchingOpenOffset(text, offset, 0);
    if (openOffset >= 0 && openOffset < $from.parentOffset) {
      return { close, pos: from + (offset - $from.parentOffset) };
    }
  }

  if ($from.parentOffset > 0) {
    const previousOffset = $from.parentOffset - 1;
    const close = text[previousOffset];
    if (closePairSpecs.has(close)) {
      const openOffset = findMatchingOpenOffset(text, previousOffset, 0);
      if (openOffset >= 0 && openOffset < previousOffset) {
        return { close, pos: from - 1 };
      }
    }
  }

  return null;
}

export const autoPairPluginState = {
  init(): AutoInsertedCloser[] {
    return [];
  },
  apply(
    tr: TransactionLike,
    value: AutoInsertedCloser[],
    _oldState: unknown,
    newState: EditorStateLike,
  ): AutoInsertedCloser[] {
    const mapped = mapAutoInsertedClosers(value, tr, newState.doc);
    const meta = tr.getMeta?.(autoPairPluginKey);
    if (isPairStateMeta(meta) && meta.type === 'add-auto-closers') {
      return mapAutoInsertedClosers([...mapped, ...meta.entries], {
        docChanged: false,
        mapping: tr.mapping,
      }, newState.doc);
    }

    const recovered = isHistoryTransaction(tr)
      ? recoverHistoryAutoCloser(tr, newState)
      : tr.docChanged && value.length > 0
        ? recoverSelectionAutoCloser(newState)
        : [];
    return mapAutoInsertedClosers([...mapped, ...recovered], {
      docChanged: false,
      mapping: tr.mapping,
    }, newState.doc);
  },
};
