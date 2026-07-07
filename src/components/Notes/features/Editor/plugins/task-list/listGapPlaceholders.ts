import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import {
    EDITABLE_LIST_GAP_PLACEHOLDER,
    LIST_GAP_PLACEHOLDER_CLASS,
    LIST_GAP_PLACEHOLDER_TASK_LIST_CLASS,
    MAX_LIST_GAP_PLACEHOLDER_CLEANUP_RANGES,
    MAX_LIST_GAP_PLACEHOLDER_DECORATIONS,
    MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS,
    MAX_LIST_GAP_TRANSACTION_STEP_TEXT_CHARS,
    MAX_ORDERED_LIST_LABEL_SCAN_NODES,
    VISIBLE_LIST_GAP_TEXT_PATTERN,
} from './listTabIndentConstants';

export function listItemContainsInternalGapPlaceholder(listItem: ProseNode): boolean {
    let scannedChars = 0;
    let found = false;

    scanProseDescendants(listItem, (node) => {
        if (!node.isText) return true;

        const text = node.text ?? '';
        const remainingChars = MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS - scannedChars;
        if (remainingChars <= 0) return STOP_PROSE_SCAN;

        const prefix = text.slice(0, remainingChars);
        scannedChars += text.length;
        if (prefix.includes(EDITABLE_LIST_GAP_PLACEHOLDER)) {
            found = true;
            return STOP_PROSE_SCAN;
        }

        return scannedChars < MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS ? true : STOP_PROSE_SCAN;
    });

    return found;
}

export function collectInternalListGapPlaceholderCleanupRanges(
    listItem: ProseNode,
    listItemStart: number
): {
    complete: boolean;
    ranges: Array<{ from: number; to: number }>;
} {
    const ranges: Array<{ from: number; to: number }> = [];
    let scannedChars = 0;
    let exhausted = false;

    const completed = scanProseDescendants(listItem, (node, pos) => {
        if (ranges.length >= MAX_LIST_GAP_PLACEHOLDER_CLEANUP_RANGES) {
            exhausted = true;
            return STOP_PROSE_SCAN;
        }
        if (!node.isText) {
            return true;
        }

        const text = node.text ?? '';
        const remainingChars = MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS - scannedChars;
        if (remainingChars <= 0 || text.length >= remainingChars) {
            exhausted = true;
            return STOP_PROSE_SCAN;
        }
        scannedChars += text.length;
        if (!text.includes(EDITABLE_LIST_GAP_PLACEHOLDER)) return true;

        for (let index = 0; index < text.length; index += 1) {
            if (text[index] !== EDITABLE_LIST_GAP_PLACEHOLDER) continue;
            const from = listItemStart + 1 + pos + index;
            ranges.push({ from, to: from + 1 });
            if (ranges.length >= MAX_LIST_GAP_PLACEHOLDER_CLEANUP_RANGES) {
                exhausted = true;
                return STOP_PROSE_SCAN;
            }
        }
        return true;
    });

    return { complete: completed && !exhausted, ranges };
}

export function isInternalListGapPlaceholderNode(node: ProseNode): boolean {
    let hasPlaceholder = false;
    let scannedChars = 0;
    let hasVisibleText = false;

    scanProseDescendants(node, (child) => {
        if (!child.isText) return true;

        const text = child.text ?? '';
        const remainingChars = MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS - scannedChars;
        if (remainingChars <= 0) return STOP_PROSE_SCAN;

        const prefix = text.slice(0, remainingChars);
        scannedChars += text.length;

        for (const char of prefix) {
            if (char === EDITABLE_LIST_GAP_PLACEHOLDER) {
                hasPlaceholder = true;
            } else if (VISIBLE_LIST_GAP_TEXT_PATTERN.test(char)) {
                hasVisibleText = true;
                return STOP_PROSE_SCAN;
            }
        }

        return scannedChars < MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS ? true : STOP_PROSE_SCAN;
    });

    return hasPlaceholder && !hasVisibleText && scannedChars < MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS;
}

function listHasDirectTaskItems(parent: ProseNode, cache: WeakMap<object, boolean>): boolean {
    if (!parent || typeof parent !== 'object') return false;
    const cached = cache.get(parent);
    if (cached !== undefined) return cached;

    const isList = parent.type?.name === 'bullet_list' || parent.type?.name === 'ordered_list';
    if (!isList || typeof parent.child !== 'function' || typeof parent.childCount !== 'number') {
        cache.set(parent, false);
        return false;
    }

    let hasTaskItem = false;
    for (let index = 0; index < parent.childCount; index += 1) {
        const child = parent.child(index);
        if (child?.type.name === 'list_item' && typeof child.attrs?.checked === 'boolean') {
            hasTaskItem = true;
            break;
        }
    }

    cache.set(parent, hasTaskItem);
    return hasTaskItem;
}

export function collectInternalListGapDecorations(doc: Parameters<typeof DecorationSet.create>[0]): Decoration[] {
    const decorations: Decoration[] = [];
    const taskListParentCache = new WeakMap<object, boolean>();

    scanProseDescendants(doc, (node, pos, parent) => {
        if (decorations.length >= MAX_LIST_GAP_PLACEHOLDER_DECORATIONS) return STOP_PROSE_SCAN;
        if (node.type?.name !== 'list_item') return true;
        if (typeof node.nodeSize !== 'number') return true;
        if (isInternalListGapPlaceholderNode(node as ProseNode)) {
            const className = listHasDirectTaskItems(parent as ProseNode, taskListParentCache)
                ? `${LIST_GAP_PLACEHOLDER_CLASS} ${LIST_GAP_PLACEHOLDER_TASK_LIST_CLASS}`
                : LIST_GAP_PLACEHOLDER_CLASS;
            decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: className,
            }));
        }
        return decorations.length < MAX_LIST_GAP_PLACEHOLDER_DECORATIONS ? true : STOP_PROSE_SCAN;
    });

    return decorations;
}

export function buildInternalListGapDecorations(doc: Parameters<typeof DecorationSet.create>[0]): DecorationSet {
    return DecorationSet.create(doc, collectInternalListGapDecorations(doc));
}

type ListGapDecorationSetLike = {
    find: (from?: number, to?: number) => unknown[];
};

function stepMayInsertInternalListGapPlaceholder(step: unknown): boolean {
    const slice = (step as { slice?: { content?: { textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; size?: number } } }).slice;
    const content = slice?.content;
    if (!content || typeof content.textBetween !== 'function' || typeof content.size !== 'number') {
        return false;
    }
    if (content.size > MAX_LIST_GAP_TRANSACTION_STEP_TEXT_CHARS) {
        return true;
    }
    return content.textBetween(0, content.size, '\n', '\ufffc').includes(EDITABLE_LIST_GAP_PLACEHOLDER);
}

function transactionInsertsInternalListGapPlaceholder(tr: unknown): boolean {
    const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
    return steps.some(stepMayInsertInternalListGapPlaceholder);
}

function listItemWithInternalPlaceholderTouchesRange(
    doc: ProseNode,
    from: number,
    to: number,
    maxScanNodes = MAX_ORDERED_LIST_LABEL_SCAN_NODES
): boolean {
    const start = Math.max(0, Math.min(from, doc.content.size));
    const end = Math.max(start, Math.min(to, doc.content.size));

    const checkResolvedPosition = (pos: number): boolean => {
        const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
            const node = $pos.node(depth);
            if (node.type.name === 'list_item' && listItemContainsInternalGapPlaceholder(node)) {
                return true;
            }
        }
        return false;
    };

    if (checkResolvedPosition(start) || checkResolvedPosition(end)) {
        return true;
    }

    let touchesPlaceholderListItem = false;
    let scannedNodes = 0;
    doc.nodesBetween(start, end, (node) => {
        scannedNodes += 1;
        if (scannedNodes > maxScanNodes) {
            touchesPlaceholderListItem = true;
            return false;
        }
        if (node.type.name === 'list_item' && listItemContainsInternalGapPlaceholder(node)) {
            touchesPlaceholderListItem = true;
            return false;
        }
        return !touchesPlaceholderListItem;
    });

    return touchesPlaceholderListItem;
}

export function transactionMayAffectInternalListGapDecorations(
    decorations: ListGapDecorationSetLike,
    tr: Transaction,
    previousDoc: ProseNode,
    nextDoc: ProseNode,
): boolean {
    if (transactionInsertsInternalListGapPlaceholder(tr)) return true;

    const diffStart = previousDoc.content.findDiffStart(nextDoc.content);
    if (diffStart === null) return false;

    const diffEnd = previousDoc.content.findDiffEnd(nextDoc.content);
    if (!diffEnd) return true;

    if (decorations.find(diffStart - 1, diffEnd.a + 1).length > 0) return true;

    return (
        listItemWithInternalPlaceholderTouchesRange(previousDoc, diffStart, diffEnd.a)
        || listItemWithInternalPlaceholderTouchesRange(nextDoc, diffStart, diffEnd.b)
    );
}
