import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { getDefaultHeadingPlaceholderText } from './headingPlaceholderText';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import {
    getTransactionChangedRanges,
    transactionInsertedTextMatches,
    transactionTouchesDecorations,
    type DecorationSetLike,
} from '../shared/transactionStepText';

export const MAX_HEADING_PLACEHOLDER_DECORATIONS = 1000;
const HEADING_PLACEHOLDER_LINE_BREAK_PATTERN = /[\n\r]/u;

export const getHeadingPlaceholder = (rawLevel: number): string => {
    return getDefaultHeadingPlaceholderText(rawLevel);
};

export const createHeadingPlaceholderDecorations = (doc: any): DecorationSet => {
    const decorations: Decoration[] = [];

    scanProseDescendants(doc, (node, pos) => {
        if (decorations.length >= MAX_HEADING_PLACEHOLDER_DECORATIONS) return STOP_PROSE_SCAN;
        if (node.type?.name !== 'heading') return true;
        if (node.content?.size !== 0) return true;
        if (typeof node.nodeSize !== 'number') return true;

        decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
                class: 'is-editor-empty',
                'data-placeholder': getHeadingPlaceholder(Number(node.attrs?.level ?? 1)),
            }),
        );

        return decorations.length < MAX_HEADING_PLACEHOLDER_DECORATIONS ? true : STOP_PROSE_SCAN;
    });

    return DecorationSet.create(doc, decorations);
};

function positionHasHeadingContext(doc: any, pos: number): boolean {
    try {
        const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
        const resolvedPos = Math.max(0, Math.min(pos, docSize));
        const $pos = doc.resolve(resolvedPos);

        for (let depth = $pos.depth; depth >= 0; depth -= 1) {
            if ($pos.node(depth)?.type?.name === 'heading') return true;
        }

        if ($pos.nodeBefore?.type?.name === 'heading') return true;
        if ($pos.nodeAfter?.type?.name === 'heading') return true;
        return doc.nodeAt?.(resolvedPos)?.type?.name === 'heading';
    } catch {
        return false;
    }
}

function transactionTouchesHeadingContext(oldDoc: any, newDoc: any, tr: unknown): boolean {
    const ranges = getTransactionChangedRanges(tr);
    if (ranges.length === 0) {
        return true;
    }

    return ranges.some((range) => (
        positionHasHeadingContext(oldDoc, range.oldFrom) ||
        positionHasHeadingContext(oldDoc, range.oldTo) ||
        positionHasHeadingContext(newDoc, range.newFrom) ||
        positionHasHeadingContext(newDoc, range.newTo)
    ));
}

export function transactionMayAffectHeadingPlaceholders(
    previous: DecorationSetLike,
    tr: unknown,
    oldDoc: any,
    newDoc: any,
): boolean {
    return transactionInsertedTextMatches(tr, HEADING_PLACEHOLDER_LINE_BREAK_PATTERN)
        || transactionTouchesDecorations(previous, tr)
        || transactionTouchesHeadingContext(oldDoc, newDoc, tr);
}
