import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { getTransactionChangedRanges } from '../../shared/transactionStepText';
import {
    MAX_MARKDOWN_LINK_DOC_SCAN_NODES,
    type MarkdownLinkScanRange,
} from './markdownLinkConfig';

function addMarkdownLinkTextblockRangeAt(doc: ProseNode, pos: number, ranges: MarkdownLinkScanRange[]): void {
    const docSize = doc.content.size;
    const safePos = Math.max(0, Math.min(pos, docSize));

    try {
        const $pos = doc.resolve(safePos);
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
            const node = $pos.node(depth);
            if (!node.isTextblock) continue;
            ranges.push({
                from: $pos.start(depth),
                to: $pos.end(depth),
            });
            return;
        }
    } catch {
    }
}

function addMarkdownLinkChangedRanges(
    doc: ProseNode,
    transactions: readonly { docChanged?: boolean }[],
    ranges: MarkdownLinkScanRange[],
    maxScanNodes = MAX_MARKDOWN_LINK_DOC_SCAN_NODES,
): void {
    const docSize = doc.content.size;
    let scannedNodes = 0;
    for (const tr of transactions) {
        if (!tr.docChanged) continue;
        for (const range of getTransactionChangedRanges(tr)) {
            const from = Math.max(0, Math.min(range.newFrom, range.newTo, docSize));
            const to = Math.max(from, Math.min(Math.max(range.newFrom, range.newTo), docSize));

            addMarkdownLinkTextblockRangeAt(doc, from, ranges);
            addMarkdownLinkTextblockRangeAt(doc, to, ranges);

            if (to > from && typeof doc.nodesBetween === 'function') {
                let exhausted = false;
                doc.nodesBetween(from, to, (node, pos) => {
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
                    ranges.push({ from: 0, to: docSize });
                    return;
                }
            }
        }
    }
}

function mergeMarkdownLinkScanRanges(ranges: MarkdownLinkScanRange[]): MarkdownLinkScanRange[] {
    if (ranges.length <= 1) return ranges;

    const sorted = [...ranges]
        .filter((range) => Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from)
        .sort((a, b) => a.from - b.from || a.to - b.to);
    const merged: MarkdownLinkScanRange[] = [];

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

export function collectMarkdownLinkAutoCollapseScanRanges(
    oldState: { doc: ProseNode; selection: { from: number; to: number; eq: (other: any) => boolean } },
    newState: { doc: ProseNode; selection: { from: number; to: number } },
    transactions: readonly { docChanged?: boolean }[],
): MarkdownLinkScanRange[] {
    const ranges: MarkdownLinkScanRange[] = [];
    const selectionChanged = !oldState.selection.eq(newState.selection);
    const hasDocChange = transactions.some((tr) => tr.docChanged);

    addMarkdownLinkChangedRanges(newState.doc, transactions, ranges);
    if (selectionChanged) {
        addMarkdownLinkTextblockRangeAt(newState.doc, newState.selection.from, ranges);
        addMarkdownLinkTextblockRangeAt(newState.doc, newState.selection.to, ranges);
        if (!hasDocChange) {
            addMarkdownLinkTextblockRangeAt(newState.doc, oldState.selection.from, ranges);
            addMarkdownLinkTextblockRangeAt(newState.doc, oldState.selection.to, ranges);
        }
    }

    return mergeMarkdownLinkScanRanges(ranges);
}
