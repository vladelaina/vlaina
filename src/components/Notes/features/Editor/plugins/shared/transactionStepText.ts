export function getTransactionInsertedText(tr: unknown): string {
  const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
  let text = '';

  for (const step of steps) {
    const slice = (step as {
      slice?: {
        content?: {
          size?: number;
          textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
        };
      };
    }).slice;
    const content = slice?.content;
    if (!content || typeof content.textBetween !== 'function' || typeof content.size !== 'number') {
      continue;
    }
    text += content.textBetween(0, content.size, '\n', '\ufffc');
  }

  return text;
}

export const MAX_TRANSACTION_INSERTED_TEXT_MATCH_CHARS = 200_000;

export function transactionInsertedTextMatches(
  tr: unknown,
  pattern: RegExp,
  maxChars = MAX_TRANSACTION_INSERTED_TEXT_MATCH_CHARS,
): boolean {
  const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
  let text = '';

  for (const step of steps) {
    const slice = (step as {
      slice?: {
        content?: {
          size?: number;
          textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
        };
      };
    }).slice;
    const content = slice?.content;
    if (!content || typeof content.textBetween !== 'function' || typeof content.size !== 'number') {
      continue;
    }

    if (content.size > maxChars || text.length + content.size > maxChars) {
      return true;
    }

    text += content.textBetween(0, content.size, '\n', '\ufffc');
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

export type TransactionChangedRange = {
  oldFrom: number;
  oldTo: number;
  newFrom: number;
  newTo: number;
};

type MappingLike = {
  maps?: readonly {
    forEach?: (
      callback: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void,
    ) => void;
  }[];
};

export type DecorationSetLike = {
  find: (from?: number, to?: number) => unknown[];
};

export function getTransactionChangedRanges(tr: unknown): TransactionChangedRange[] {
  const mapping = (tr as { mapping?: MappingLike }).mapping;
  const maps = mapping?.maps ?? [];
  const ranges: TransactionChangedRange[] = [];

  for (const map of maps) {
    if (typeof map.forEach !== 'function') {
      continue;
    }
    map.forEach((oldFrom, oldTo, newFrom, newTo) => {
      ranges.push({ oldFrom, oldTo, newFrom, newTo });
    });
  }

  return ranges;
}

export function transactionTouchesDecorations(
  decorations: DecorationSetLike,
  tr: unknown,
  margin = 1,
): boolean {
  return getTransactionChangedRanges(tr).some(({ oldFrom, oldTo }) => {
    const from = Math.max(0, Math.min(oldFrom, oldTo) - margin);
    const to = Math.max(oldFrom, oldTo) + margin;
    return decorations.find(from, to).length > 0;
  });
}

export function transactionChangedParentTextMatches(doc: any, tr: unknown, pattern: RegExp): boolean {
  const ranges = getTransactionChangedRanges(tr);
  for (const range of ranges) {
    for (const pos of [range.newFrom, range.newTo]) {
      try {
        const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
        if (!$pos.parent?.isTextblock) {
          continue;
        }
        pattern.lastIndex = 0;
        if (pattern.test($pos.parent.textBetween(0, $pos.parent.content.size, '\n', '\ufffc'))) {
          return true;
        }
      } catch {
      }
    }
  }
  return false;
}

export function transactionChangedPreviousParentTextMatches(doc: any, tr: unknown, pattern: RegExp): boolean {
  const ranges = getTransactionChangedRanges(tr);
  for (const range of ranges) {
    for (const pos of [range.oldFrom, range.oldTo]) {
      try {
        const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
        if (!$pos.parent?.isTextblock) {
          continue;
        }
        pattern.lastIndex = 0;
        if (pattern.test($pos.parent.textBetween(0, $pos.parent.content.size, '\n', '\ufffc'))) {
          return true;
        }
      } catch {
      }
    }
  }
  return false;
}
