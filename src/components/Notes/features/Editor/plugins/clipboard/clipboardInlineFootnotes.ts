import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';
import type { Mark } from '@milkdown/kit/prose/model';

import { createClipboardTraversalBudget, consumeClipboardTraversalNode } from './clipboardTraversalBudget';
import {
    MAX_INLINE_FOOTNOTE_PASTE_LABEL_CHARS,
    MAX_INLINE_FOOTNOTE_PASTE_REFERENCES,
    MAX_INLINE_FOOTNOTE_PASTE_TEXT_CHARS,
} from './clipboardPluginConstants';

const INLINE_FOOTNOTE_REFERENCE_PATTERN = /\[\^([^\]\r\n]+)\]/g;

export type FootnoteReferenceState = {
    schema: {
        text: (text: string, marks?: readonly Mark[]) => ProseNode;
        nodes: {
            footnote_reference?: { create: (attrs: { label: string }) => ProseNode };
            footnote_ref?: { create: (attrs: { id: string }) => ProseNode };
        };
    };
};

function createFootnoteReferenceNode(state: FootnoteReferenceState, id: string): ProseNode | null {
    const footnoteReferenceType = state.schema.nodes.footnote_reference;
    if (footnoteReferenceType) {
        return footnoteReferenceType.create({ label: id });
    }

    const legacyFootnoteRefType = state.schema.nodes.footnote_ref;
    if (legacyFootnoteRefType) {
        return legacyFootnoteRefType.create({ id });
    }

    return null;
}

function splitTextNodeWithInlineFootnotes(state: FootnoteReferenceState, node: ProseNode): ProseNode[] | null {
    const text = node.text ?? '';
    if (!text || !text.includes('[^') || node.marks.some((mark) => mark.type.name === 'inlineCode')) {
        return null;
    }
    if (text.length > MAX_INLINE_FOOTNOTE_PASTE_TEXT_CHARS) {
        return null;
    }

    const nodes: ProseNode[] = [];
    let lastIndex = 0;
    let hasFootnote = false;
    let referenceCount = 0;

    for (const match of text.matchAll(INLINE_FOOTNOTE_REFERENCE_PATTERN)) {
        const rawId = match[1]?.trim();
        referenceCount += 1;
        if (referenceCount > MAX_INLINE_FOOTNOTE_PASTE_REFERENCES) {
            return null;
        }
        if (rawId && rawId.length > MAX_INLINE_FOOTNOTE_PASTE_LABEL_CHARS) {
            return null;
        }
        if (!rawId) continue;

        const index = match.index ?? 0;
        if (index > lastIndex) {
            nodes.push(state.schema.text(text.slice(lastIndex, index), node.marks));
        }

        const footnoteNode = createFootnoteReferenceNode(state, rawId);
        if (!footnoteNode) return null;
        nodes.push(footnoteNode);
        lastIndex = index + match[0].length;
        hasFootnote = true;
    }

    if (!hasFootnote) return null;

    if (lastIndex < text.length) {
        nodes.push(state.schema.text(text.slice(lastIndex), node.marks));
    }

    return nodes;
}

function replaceInlineFootnoteReferencesInNode(
    state: FootnoteReferenceState,
    node: ProseNode,
    budget: ReturnType<typeof createClipboardTraversalBudget>,
    depth: number,
): ProseNode[] {
    if (!consumeClipboardTraversalNode(budget, depth)) {
        return [node];
    }

    if (node.isText) {
        return splitTextNodeWithInlineFootnotes(state, node) ?? [node];
    }

    if (node.type.spec.code || node.isLeaf || node.content.childCount === 0) {
        return [node];
    }

    let changed = false;
    const children: ProseNode[] = [];
    node.content.forEach((child) => {
        const replacement = budget.exceeded
            ? [child]
            : replaceInlineFootnoteReferencesInNode(state, child, budget, depth + 1);
        children.push(...replacement);
        if (replacement.length !== 1 || replacement[0] !== child) {
            changed = true;
        }
    });

    return changed ? [node.copy(Fragment.fromArray(children))] : [node];
}

export function replaceInlineFootnoteReferencesInNodes(state: FootnoteReferenceState, nodes: ProseNode[]): ProseNode[] {
    const budget = createClipboardTraversalBudget();
    const replacementNodes: ProseNode[] = [];

    for (const node of nodes) {
        if (budget.exceeded) {
            return nodes;
        }
        replacementNodes.push(...replaceInlineFootnoteReferencesInNode(state, node, budget, 1));
    }

    return budget.exceeded ? nodes : replacementNodes;
}

export function createInlineFootnoteReferenceSlice(state: FootnoteReferenceState, text: string): Slice | null {
    if (!text || /[\r\n]/.test(text)) return null;

    const textNode = state.schema.text(text);
    const nodes = splitTextNodeWithInlineFootnotes(state, textNode);
    if (!nodes) return null;

    return new Slice(Fragment.fromArray(nodes), 0, 0);
}
