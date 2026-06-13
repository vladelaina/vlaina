// Definition list plugin
// Supports: term\n: definition syntax

import { remarkPluginsCtx, schemaTimerCtx } from '@milkdown/core';
import { createTimer, type MilkdownPlugin } from '@milkdown/ctx';
import { $node, $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { remarkDefinitionLists } from '@/components/common/markdown/definitionListMarkdown';
import {
    DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
    SKIP_PROSE_DESCENDANTS,
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import {
    getTransactionChangedRanges,
    transactionChangedParentTextMatches,
    transactionInsertedTextMatches,
    transactionTouchesDecorations,
    type DecorationSetLike,
} from '../shared/transactionStepText';

const definitionListsRemarkReady = createTimer('definitionListsRemarkReady');

export const remarkDefinitionListsPlugin: MilkdownPlugin = (ctx) => {
    ctx.record(definitionListsRemarkReady);
    ctx.update(schemaTimerCtx, (timers) => timers.concat(definitionListsRemarkReady));

    return async () => {
        const remarkPlugin = {
            plugin: remarkDefinitionLists,
            options: undefined,
        };

        ctx.update(remarkPluginsCtx, (plugins) => plugins.concat(remarkPlugin as any));
        ctx.done(definitionListsRemarkReady);

        return () => {
            ctx.update(remarkPluginsCtx, (plugins) => plugins.filter((plugin) => plugin !== (remarkPlugin as any)));
            ctx.update(schemaTimerCtx, (timers) => timers.filter((timer) => timer !== definitionListsRemarkReady));
            ctx.clearTimer(definitionListsRemarkReady);
        };
    };
};

// Definition List container
export const definitionListSchema = $node('definition_list', () => ({
    content: '(definition_term definition_desc)+',
    group: 'block',
    defining: true,
    parseDOM: [{
        tag: 'dl'
    }],
    toDOM: () => ['dl', { class: 'definition-list' }, 0],
    parseMarkdown: {
        match: (node) => node.type === 'definitionList',
        runner: (state, node, type) => {
            state.openNode(type);
            state.next(node.children);
            state.closeNode();
        }
    },
    toMarkdown: {
        match: (node) => node.type.name === 'definition_list',
        runner: (state, node) => {
            // Output as plain text with term: definition format
            node.forEach((child) => {
                state.next(child);
            });
        }
    }
}));

// Definition Term (dt)
export const definitionTermSchema = $node('definition_term', () => ({
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [{
        tag: 'dt'
    }],
    toDOM: () => ['dt', { class: 'definition-term' }, 0],
    parseMarkdown: {
        match: (node) => node.type === 'definitionTerm',
        runner: (state, node, type) => {
            state.openNode(type);
            state.next(node.children);
            state.closeNode();
        }
    },
    toMarkdown: {
        match: (node) => node.type.name === 'definition_term',
        runner: (state, node) => {
            state.openNode('paragraph');
            state.next(node.content);
            state.closeNode();
        }
    }
}));

// Definition Description (dd)
export const definitionDescSchema = $node('definition_desc', () => ({
    content: 'block+',
    group: 'block',
    defining: true,
    parseDOM: [{
        tag: 'dd'
    }],
    toDOM: () => ['dd', { class: 'definition-desc' }, 0],
    parseMarkdown: {
        match: (node) => node.type === 'definitionDescription',
        runner: (state, node, type) => {
            state.openNode(type);
            state.next(node.children);
            state.closeNode();
        }
    },
    toMarkdown: {
        match: (node) => node.type.name === 'definition_desc',
        runner: (state, node) => {
            state.openNode('paragraph');
            state.addNode('text', undefined, ': ');
            const firstChild = node.firstChild;
            if (firstChild?.type.name === 'paragraph') {
                state.next(firstChild.content);
                state.closeNode();
                for (let index = 1; index < node.childCount; index += 1) {
                    state.next(node.child(index));
                }
                return;
            }
            state.closeNode();
            state.next(node.content);
        }
    }
}));

// Visual emulation plugin for pseudo definition lists (Term \n : Definition)
// This handles the case where lack of remark-deflist causes DLs to be parsed as paragraphs
const deflistVisualPluginKey = new PluginKey<DecorationSet>('deflist-visual');
export const MAX_DEFLIST_VISUAL_DECORATIONS = 1000;
export const MAX_DEFLIST_VISUAL_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
const MAX_DEFLIST_TERM_CHARS = 80;
const MAX_DEFLIST_EMPTY_SCAN_CHARS = 256;
const DEFLIST_TRIGGER_TEXT_PATTERN = /[:\n\r]/u;
const DEFLIST_DESCRIPTION_PREFIX_PATTERN = /^: /u;

function isEscapedDefinitionListDescription(node: Node): boolean {
    return node.attrs?.vlainaEscapedBlockSyntax === 'definitionListDescription';
}

function getNodeTextPrefix(node: Node, maxChars: number): string {
    const contentSize = typeof node.content?.size === 'number' ? node.content.size : maxChars;
    return node.textBetween(0, Math.min(contentSize, maxChars), undefined, undefined);
}

function isVisuallyEmptyBlock(node: Node): boolean {
    if (node.content.size === 0) return true;
    if (node.content.size > MAX_DEFLIST_EMPTY_SCAN_CHARS) return false;
    return getNodeTextPrefix(node, MAX_DEFLIST_EMPTY_SCAN_CHARS).trim().length === 0;
}

function startsWithDefinitionDescriptionPrefix(node: Node): boolean {
    return getNodeTextPrefix(node, 2) === ': ';
}

function isDefinitionDescriptionParagraph(node: Node | null | undefined): boolean {
    return (
        !!node &&
        node.type.name === 'paragraph' &&
        !isEscapedDefinitionListDescription(node) &&
        startsWithDefinitionDescriptionPrefix(node)
    );
}

function isValidDefinitionTerm(node: Node | null): node is Node {
    return (
        !!node &&
        node.type.name === 'paragraph' &&
        !isEscapedDefinitionListDescription(node) &&
        getNodeTextPrefix(node, MAX_DEFLIST_TERM_CHARS).length < MAX_DEFLIST_TERM_CHARS
    );
}

export function createDeflistDecorations(doc: Node): DecorationSet {
    const decorations: Decoration[] = [];
    let lastNonEmptyNode: Node | null = null;
    let lastNonEmptyPos = -1;
    let lastNode: Node | null = null;

    scanProseDescendants(doc, (node, pos) => {
        if (decorations.length >= MAX_DEFLIST_VISUAL_DECORATIONS) {
            return STOP_PROSE_SCAN;
        }

        if (node.isBlock) {
            const blockNode = node as Node;
            const isEmpty = isVisuallyEmptyBlock(blockNode);

            // Check if current node looks like a Definition Description
            if (
                isDefinitionDescriptionParagraph(blockNode)
            ) {

                // HEURISTIC: A true Definition List usually follows a short Term.
                // If the previous paragraph is very long, it's likely just normal text, not a Term.
                const isTermValid = isValidDefinitionTerm(lastNonEmptyNode);

                if (isTermValid) {
                    // Mark current node as DD
                    const classes = ['editor-dl-desc'];

                    // If the immediate previous node was empty, we need to pull up more
                    if (lastNode && isVisuallyEmptyBlock(lastNode)) {
                        classes.push('editor-dl-gap-fix');
                    }

                    decorations.push(
                        Decoration.node(pos, pos + blockNode.nodeSize, {
                            class: classes.join(' '),
                        })
                    );

                    // Mark previous node as DT
                    decorations.push(
                        Decoration.node(lastNonEmptyPos, lastNonEmptyPos + lastNonEmptyNode!.nodeSize, {
                            class: 'editor-dl-term',
                        })
                    );
                    if (decorations.length >= MAX_DEFLIST_VISUAL_DECORATIONS) {
                        return STOP_PROSE_SCAN;
                    }
                }
            }
            // Update tracking
            lastNode = blockNode;
            if (!isEmpty) {
                lastNonEmptyNode = blockNode;
                lastNonEmptyPos = pos;
            }

            return SKIP_PROSE_DESCENDANTS;
        }
        return true;
    }, MAX_DEFLIST_VISUAL_DOC_SCAN_NODES);

    return DecorationSet.create(doc, decorations);
}

function nearbyBlockMayAffectDefinitionList(doc: Node, pos: number): boolean {
    try {
        const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
            const parent = $pos.node(depth - 1);
            const index = $pos.index(depth - 1);

            for (let offset = -2; offset <= 2; offset += 1) {
                const childIndex = index + offset;
                if (childIndex < 0 || childIndex >= parent.childCount) {
                    continue;
                }
                if (isDefinitionDescriptionParagraph(parent.child(childIndex))) {
                    return true;
                }
            }
        }
    } catch {
    }
    return false;
}

function changedRangeContainsDefinitionDescriptionParagraph(doc: Node, tr: unknown): boolean {
    if (typeof doc.nodesBetween !== 'function') return false;
    const ranges = getTransactionChangedRanges(tr);
    for (const range of ranges) {
        const from = Math.max(0, Math.min(range.newFrom, range.newTo, doc.content.size));
        const to = Math.max(from, Math.min(Math.max(range.newFrom, range.newTo), doc.content.size));
        if (to <= from) continue;

        let found = false;
        doc.nodesBetween(from, to, (node) => {
            if (isDefinitionDescriptionParagraph(node)) {
                found = true;
                return false;
            }
            return !found;
        });
        if (found) return true;
    }

    return false;
}

export function transactionMayAffectDeflistDecorations(
    previous: DecorationSetLike,
    tr: unknown,
    doc: Node,
): boolean {
    if (transactionTouchesDecorations(previous, tr)) {
        return true;
    }
    if (transactionChangedParentTextMatches(doc, tr, DEFLIST_DESCRIPTION_PREFIX_PATTERN)) {
        return true;
    }
    if (
        transactionInsertedTextMatches(tr, DEFLIST_TRIGGER_TEXT_PATTERN) &&
        changedRangeContainsDefinitionDescriptionParagraph(doc, tr)
    ) {
        return true;
    }

    const ranges = getTransactionChangedRanges(tr);
    if (ranges.length === 0) {
        return true;
    }
    return ranges.some((range) => (
        nearbyBlockMayAffectDefinitionList(doc, range.newFrom) ||
        nearbyBlockMayAffectDefinitionList(doc, range.newTo)
    ));
}

export const deflistVisualPlugin = $prose(() => {
    return new Plugin({
        key: deflistVisualPluginKey,
        state: {
            init: (_config, state) => createDeflistDecorations(state.doc),
            apply: (tr, previous) => {
                if (!tr.docChanged) {
                    return previous.map(tr.mapping, tr.doc);
                }
                if (!transactionMayAffectDeflistDecorations(previous, tr, tr.doc)) {
                    return previous.map(tr.mapping, tr.doc);
                }
                return createDeflistDecorations(tr.doc);
            },
        },
        props: {
            decorations(state) {
                return deflistVisualPluginKey.getState(state) ?? DecorationSet.empty;
            },
        },
    });
});

// Combined definition list plugin
export const deflistPlugin = [
    remarkDefinitionListsPlugin,
    definitionListSchema,
    definitionTermSchema,
    definitionDescSchema,
    deflistVisualPlugin
];
