import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { getTransactionChangedRanges } from '../../shared/transactionStepText';
import {
    AUTOLINK_TRIGGER_TEXT_PATTERN,
    MAX_AUTOLINK_CHANGED_CONTEXT_CHARS,
    MAX_AUTOLINK_DECORATIONS,
    MAX_AUTOLINK_TRANSACTION_STEP_TEXT_CHARS,
    MAX_AUTOLINK_UPDATE_RANGE_SCAN_NODES,
} from './autolinkConstants';
import {
    collectAutolinkDecorationsInRange,
    textMayContainAutolinkCandidate,
} from './autolinkDecorations';

function transactionStepMayCreateAutolink(step: unknown): boolean {
    const slice = (step as { slice?: { content?: { textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; size?: number } } }).slice;
    const content = slice?.content;
    if (!content || typeof content.textBetween !== 'function' || typeof content.size !== 'number') {
        return false;
    }
    if (content.size > MAX_AUTOLINK_TRANSACTION_STEP_TEXT_CHARS) {
        return true;
    }
    return AUTOLINK_TRIGGER_TEXT_PATTERN.test(content.textBetween(0, content.size, '\n', '\ufffc'));
}

export function transactionMayCreateAutolink(tr: unknown): boolean {
    const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
    if (steps.length === 0) {
        return false;
    }

    return steps.some(transactionStepMayCreateAutolink);
}

export function transactionChangedContextMayContainAutolinkCandidate(doc: any, tr: unknown): boolean {
    if (typeof doc.textBetween !== 'function') return false;

    const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
    for (const range of getTransactionChangedRanges(tr)) {
        for (const pos of [range.newFrom, range.newTo]) {
            const safePos = Math.max(0, Math.min(pos, docSize));
            const from = Math.max(0, safePos - MAX_AUTOLINK_CHANGED_CONTEXT_CHARS);
            const to = Math.min(docSize, safePos + MAX_AUTOLINK_CHANGED_CONTEXT_CHARS);
            if (from >= to) continue;
            if (textMayContainAutolinkCandidate(doc.textBetween(from, to, '\n', '\ufffc'))) {
                return true;
            }
        }
    }

    return false;
}

type AutolinkDecorationSetLike = {
    find: (from?: number, to?: number) => unknown[];
};

type MappingLike = {
    maps?: readonly {
        forEach?: (
            callback: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void,
        ) => void;
    }[];
};

export function transactionMayAffectExistingAutolinks(
    decorations: AutolinkDecorationSetLike,
    tr: unknown,
): boolean {
    const mapping = (tr as { mapping?: MappingLike }).mapping;
    const maps = mapping?.maps ?? [];
    for (const map of maps) {
        if (typeof map.forEach !== 'function') {
            continue;
        }

        let affectsAutolink = false;
        map.forEach((oldStart, oldEnd) => {
            if (affectsAutolink) {
                return;
            }

            const from = Math.max(0, Math.min(oldStart, oldEnd) - 1);
            const to = Math.max(oldStart, oldEnd) + 1;
            affectsAutolink = decorations.find(from, to).length > 0;
        });

        if (affectsAutolink) {
            return true;
        }
    }

    return false;
}

type AutolinkUpdateRange = {
    from: number;
    to: number;
};

function addTextblockRangeAt(doc: any, pos: number, ranges: AutolinkUpdateRange[]): void {
    if (typeof doc.resolve !== 'function') return;
    const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
    const safePos = Math.max(0, Math.min(pos, docSize));

    try {
        const $pos = doc.resolve(safePos);
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
            const node = $pos.node(depth);
            if (!node?.isTextblock) continue;
            ranges.push({
                from: $pos.start(depth),
                to: $pos.end(depth),
            });
            return;
        }
    } catch {
    }
}

function mergeAutolinkUpdateRanges(ranges: AutolinkUpdateRange[]): AutolinkUpdateRange[] {
    if (ranges.length <= 1) return ranges;

    const sorted = [...ranges]
        .filter((range) => Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from)
        .sort((a, b) => a.from - b.from || a.to - b.to);
    const merged: AutolinkUpdateRange[] = [];

    for (const range of sorted) {
        const previous = merged[merged.length - 1];
        if (!previous || range.from > previous.to + 1) {
            merged.push({ ...range });
            continue;
        }
        previous.to = Math.max(previous.to, range.to);
    }

    return merged;
}

export function collectAutolinkUpdateRanges(
    doc: any,
    tr: unknown,
    maxScanNodes = MAX_AUTOLINK_UPDATE_RANGE_SCAN_NODES,
): AutolinkUpdateRange[] {
    const ranges: AutolinkUpdateRange[] = [];
    const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
    let scannedNodes = 0;

    for (const range of getTransactionChangedRanges(tr)) {
        const from = Math.max(0, Math.min(range.newFrom, range.newTo, docSize));
        const to = Math.max(from, Math.min(Math.max(range.newFrom, range.newTo), docSize));

        addTextblockRangeAt(doc, from, ranges);
        addTextblockRangeAt(doc, to, ranges);

        if (to > from && typeof doc.nodesBetween === 'function') {
            let exhausted = false;
            doc.nodesBetween(from, to, (node: any, pos: number) => {
                scannedNodes += 1;
                if (scannedNodes > maxScanNodes) {
                    exhausted = true;
                    return false;
                }
                if (!node.isTextblock || typeof node.nodeSize !== 'number') return true;
                ranges.push({
                    from: pos + 1,
                    to: Math.max(pos + 1, pos + node.nodeSize - 1),
                });
                return true;
            });
            if (exhausted) {
                return [{ from: 0, to: docSize }];
            }
        }
    }

    return mergeAutolinkUpdateRanges(ranges);
}

export function updateAutolinkDecorationsForTransaction(
    previous: DecorationSet,
    tr: unknown,
    doc: any,
): DecorationSet {
    const mapped = previous.map((tr as { mapping: any }).mapping, doc);
    const ranges = collectAutolinkUpdateRanges(doc, tr);
    if (ranges.length === 0) {
        return mapped;
    }

    const decorationsToRemove: Decoration[] = [];
    for (const range of ranges) {
        decorationsToRemove.push(...mapped.find(range.from, range.to) as Decoration[]);
    }

    let next = decorationsToRemove.length > 0
        ? mapped.remove(decorationsToRemove)
        : mapped;
    let remainingBudget = MAX_AUTOLINK_DECORATIONS - next.find().length;
    if (remainingBudget <= 0) {
        return next;
    }

    for (const range of ranges) {
        if (remainingBudget <= 0) break;
        const decorations = collectAutolinkDecorationsInRange(doc, range.from, range.to, remainingBudget);
        if (decorations.length === 0) continue;
        next = next.add(doc, decorations);
        remainingBudget -= decorations.length;
    }

    return next;
}
