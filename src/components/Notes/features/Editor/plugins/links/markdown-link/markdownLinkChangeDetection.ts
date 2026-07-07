import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../../shared/boundedProseNodeScan';
import { getTransactionChangedRanges } from '../../shared/transactionStepText';
import {
    MARKDOWN_LINK_TRIGGER_TEXT_PATTERN,
    MAX_MARKDOWN_LINK_DOC_SCAN_NODES,
    MAX_MARKDOWN_LINK_INPUT_LOOKBACK_CHARS,
    MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS,
    MAX_MARKDOWN_LINK_TRANSACTION_STEP_TEXT_CHARS,
} from './markdownLinkConfig';
import { MARKDOWN_LINK_PATTERN_GLOBAL } from './markdownLinkParser';

function transactionStepMayCreateMarkdownLink(step: unknown): boolean {
    const slice = (step as { slice?: { content?: { textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; size?: number } } }).slice;
    const content = slice?.content;
    if (!content || typeof content.textBetween !== 'function' || typeof content.size !== 'number') {
        return false;
    }
    if (content.size > MAX_MARKDOWN_LINK_TRANSACTION_STEP_TEXT_CHARS) {
        return true;
    }
    return MARKDOWN_LINK_TRIGGER_TEXT_PATTERN.test(content.textBetween(0, content.size, '\n', '\ufffc'));
}

export function transactionMayCreateMarkdownLink(tr: unknown): boolean {
    const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
    return steps.some(transactionStepMayCreateMarkdownLink);
}

export function textContainsRawMarkdownLink(text: string): boolean {
    const scanText = text.slice(0, MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS);
    if (!MARKDOWN_LINK_TRIGGER_TEXT_PATTERN.test(scanText)) {
        return false;
    }

    MARKDOWN_LINK_PATTERN_GLOBAL.lastIndex = 0;
    return MARKDOWN_LINK_PATTERN_GLOBAL.test(scanText);
}

export function getMarkdownLinkInputTextBeforeCursor(
    parent: { textBetween: (from: number, to: number, blockSeparator?: string | null, leafText?: string | null) => string },
    parentOffset: number,
): string {
    return parent.textBetween(
        Math.max(0, parentOffset - MAX_MARKDOWN_LINK_INPUT_LOOKBACK_CHARS),
        parentOffset,
        '\0',
        '\0'
    );
}

function positionTouchesRawMarkdownLink(doc: ProseNode, pos: number): boolean {
    const resolvedPos = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(resolvedPos);

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth);
        if (node.isTextblock && textContainsRawMarkdownLink(node.textBetween(0, node.content.size, '\n', '\ufffc'))) {
            return true;
        }
    }

    const nodeBefore = $pos.nodeBefore;
    const nodeAfter = $pos.nodeAfter;
    return Boolean(
        (nodeBefore?.isText && textContainsRawMarkdownLink(nodeBefore.text ?? ''))
        || (nodeAfter?.isText && textContainsRawMarkdownLink(nodeAfter.text ?? ''))
    );
}

export function rangeTouchesRawMarkdownLink(
    doc: ProseNode,
    from: number,
    to: number,
    checkBoundaryPositions = true,
    maxScanNodes = MAX_MARKDOWN_LINK_DOC_SCAN_NODES,
): boolean {
    const start = Math.max(0, Math.min(from, doc.content.size));
    const end = Math.max(start, Math.min(to, doc.content.size));
    if (
        checkBoundaryPositions
        && (positionTouchesRawMarkdownLink(doc, start) || positionTouchesRawMarkdownLink(doc, end))
    ) {
        return true;
    }

    const nodesBetween = (doc as {
        nodesBetween?: (
            from: number,
            to: number,
            callback: (node: ProseNode, pos: number) => boolean | void,
        ) => void;
    }).nodesBetween;
    if (typeof nodesBetween === 'function') {
        let touchesRawMarkdownLink = false;
        let scannedNodes = 0;
        const scanTo = Math.min(doc.content.size, Math.max(start + 1, end));
        if (scanTo <= start) return false;

        nodesBetween.call(doc, start, scanTo, (node) => {
            scannedNodes += 1;
            if (scannedNodes > maxScanNodes) {
                touchesRawMarkdownLink = true;
                return false;
            }
            if (node.isText && textContainsRawMarkdownLink(node.text ?? '')) {
                touchesRawMarkdownLink = true;
                return false;
            }
            return true;
        });

        return touchesRawMarkdownLink;
    }

    let touchesRawMarkdownLink = false;
    const scanTo = Math.min(doc.content.size, Math.max(start + 1, end));
    scanProseDescendants(doc, (node, pos) => {
        const nodeSize = typeof node.nodeSize === 'number' ? node.nodeSize : 1;
        const nodeEnd = pos + nodeSize;
        if (nodeEnd < start) return true;
        if (pos > scanTo) return STOP_PROSE_SCAN;
        if (node.isText && textContainsRawMarkdownLink(node.text ?? '')) {
            touchesRawMarkdownLink = true;
            return STOP_PROSE_SCAN;
        }
        return true;
    }, MAX_MARKDOWN_LINK_DOC_SCAN_NODES);

    return touchesRawMarkdownLink;
}

export function docChangeMayAffectRawMarkdownLink(prevDoc: ProseNode, nextDoc: ProseNode): boolean {
    const diffStart = prevDoc.content.findDiffStart(nextDoc.content);
    if (diffStart === null) return false;

    const diffEnd = prevDoc.content.findDiffEnd(nextDoc.content);
    if (!diffEnd) return true;

    return (
        rangeTouchesRawMarkdownLink(prevDoc, diffStart, diffEnd.a)
        || rangeTouchesRawMarkdownLink(nextDoc, diffStart, diffEnd.b)
    );
}

export function transactionChangeMayAffectRawMarkdownLink(
    prevDoc: ProseNode,
    nextDoc: ProseNode,
    tr: unknown,
): boolean {
    const ranges = getTransactionChangedRanges(tr);
    if (ranges.length === 0) {
        return docChangeMayAffectRawMarkdownLink(prevDoc, nextDoc);
    }

    return ranges.some((range) => (
        rangeTouchesRawMarkdownLink(prevDoc, range.oldFrom, range.oldTo)
        || rangeTouchesRawMarkdownLink(nextDoc, range.newFrom, range.newTo)
    ));
}

export function isMarkdownImagePatternBeforeCursor(textBefore: string, fullMatch: string): boolean {
    const matchStart = textBefore.length - fullMatch.length;
    return matchStart > 0 && textBefore[matchStart - 1] === '!';
}

export function docHasRawMarkdownLink(doc: ProseNode): boolean {
    let hasRawMarkdownLink = false;
    scanProseDescendants(doc, (node) => {
        if (!node.isText || !node.text) return true;

        hasRawMarkdownLink = textContainsRawMarkdownLink(node.text);
        return hasRawMarkdownLink ? STOP_PROSE_SCAN : true;
    }, MAX_MARKDOWN_LINK_DOC_SCAN_NODES);
    return hasRawMarkdownLink;
}
