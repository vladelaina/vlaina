import { type Node as ProseNode } from '@milkdown/kit/prose/model';
import type { Parser } from '@milkdown/kit/transformer';

import { normalizeAlternativeMathBlockFences } from '@/lib/notes/markdown/markdownSerializationUtils';

import { isMarkdownStructuralResult } from './pasteCursorUtils';
import { MAX_MARKDOWN_PASTE_CHARS, MAX_MARKDOWN_PASTE_TOP_LEVEL_NODES } from './clipboardPluginConstants';
import { prepareMarkdownPasteInput } from './clipboardMarkdownNormalization';

export function isMarkdownPasteParserInputWithinBounds(text: string): boolean {
    return text.length <= MAX_MARKDOWN_PASTE_CHARS;
}

export function parseStandaloneMathBlockPaste(state: {
    schema: {
        nodes: {
            math_block?: { create: (attrs: { latex: string }) => ProseNode };
        };
    };
}, text: string): ProseNode | null {
    const mathBlockType = state.schema.nodes.math_block;
    if (!mathBlockType) return null;

    const normalized = normalizeAlternativeMathBlockFences(text).trim();
    const lines = normalized.split('\n');
    if (lines.length < 3 || lines[0]?.trim() !== '$$' || lines[lines.length - 1]?.trim() !== '$$') {
        return null;
    }

    const latex = lines.slice(1, -1).join('\n').trim();
    if (!latex) return null;

    return mathBlockType.create({ latex });
}

export function collectMarkdownPasteTopLevelNodes(parsedDoc: ProseNode): ProseNode[] | null {
    const { content } = parsedDoc;
    if (!content) return null;

    const { childCount } = content;
    if (typeof childCount !== 'number') return null;

    if (childCount > MAX_MARKDOWN_PASTE_TOP_LEVEL_NODES) {
        return null;
    }

    const parsedNodes: ProseNode[] = [];
    content.forEach((node) => {
        parsedNodes.push(node);
    });

    return parsedNodes;
}

export function parseMarkdownNodes(text: string, parser: Parser | null): ProseNode[] | null {
    if (!isMarkdownPasteParserInputWithinBounds(text) || !parser) {
        return null;
    }

    const editorInput = prepareMarkdownPasteInput(text, isMarkdownPasteParserInputWithinBounds);
    if (!editorInput) return null;

    let parsedDoc: ProseNode;
    try {
        parsedDoc = parser(editorInput);
    } catch {
        return null;
    }

    const parsedNodes = collectMarkdownPasteTopLevelNodes(parsedDoc);
    if (!parsedNodes) return null;

    return isMarkdownStructuralResult(parsedNodes) ? parsedNodes : null;
}
