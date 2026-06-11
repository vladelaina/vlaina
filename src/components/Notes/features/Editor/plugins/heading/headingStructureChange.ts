import {
    getTransactionChangedRanges,
    transactionInsertedTextMatches,
} from '../shared/transactionStepText';

const HEADING_STRUCTURE_LINE_BREAK_PATTERN = /[\n\r]/u;
const HEADING_STRUCTURE_MARKER_PATTERN = /#/u;
const MARKDOWN_HEADING_PREFIX_PATTERN = /^\s{0,3}#{1,6}(?:\s|$)/u;
const MARKDOWN_HEADING_PREFIX_SCAN_CHARS = 12;

function clampDocPos(doc: any, pos: number): number {
    const size = typeof doc?.content?.size === 'number' ? doc.content.size : 0;
    return Math.max(0, Math.min(pos, size));
}

function positionHasHeadingStructureContext(doc: any, pos: number): boolean {
    try {
        const $pos = doc.resolve(clampDocPos(doc, pos));

        for (let depth = $pos.depth; depth >= 0; depth -= 1) {
            if ($pos.node(depth)?.type?.name === 'heading') {
                return true;
            }
        }

        const parent = $pos.parent;
        if (!parent?.isTextblock || typeof parent.textBetween !== 'function') {
            return false;
        }

        const prefix = parent.textBetween(
            0,
            Math.min(parent.content?.size ?? 0, MARKDOWN_HEADING_PREFIX_SCAN_CHARS),
            '\n',
            '\ufffc',
        );
        return MARKDOWN_HEADING_PREFIX_PATTERN.test(prefix);
    } catch {
        return false;
    }
}

export function transactionInsertedTextMayAffectHeadingStructure(
    tr: unknown,
    newDoc: any,
): boolean {
    if (transactionInsertedTextMatches(tr, HEADING_STRUCTURE_LINE_BREAK_PATTERN)) {
        return true;
    }
    if (!transactionInsertedTextMatches(tr, HEADING_STRUCTURE_MARKER_PATTERN)) {
        return false;
    }

    const ranges = getTransactionChangedRanges(tr);
    if (ranges.length === 0) {
        return true;
    }

    return ranges.some((range) => (
        positionHasHeadingStructureContext(newDoc, range.newFrom) ||
        positionHasHeadingStructureContext(newDoc, range.newTo)
    ));
}
