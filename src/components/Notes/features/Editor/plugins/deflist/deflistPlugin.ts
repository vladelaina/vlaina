// Definition list plugin
// Supports: term\n: definition syntax

import { $node, $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';

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
            state.next(node.content);
            state.closeNode();
        }
    }
}));

// Visual emulation plugin for pseudo definition lists (Term \n : Definition)
// This handles the case where lack of remark-deflist causes DLs to be parsed as paragraphs
export const deflistVisualPlugin = $prose(() => {
    return new Plugin({
        key: new PluginKey('deflist-visual'),
        props: {
            decorations(state) {
                const decorations: Decoration[] = [];
                let lastNonEmptyNode: Node | null = null;
                let lastNonEmptyPos = -1;
                let lastNode: Node | null = null;

                state.doc.descendants((node, pos) => {
                    if (node.isBlock) {
                        const isEmpty = node.textContent.trim().length === 0;

                        // Check if current node looks like a Definition Description
                        if (node.type.name === 'paragraph' && node.textContent.startsWith(': ')) {

                            // HEURISTIC: A true Definition List usually follows a short Term.
                            // If the previous paragraph is very long, it's likely just normal text, not a Term.
                            const isTermValid = lastNonEmptyNode &&
                                lastNonEmptyNode.type.name === 'paragraph' &&
                                lastNonEmptyNode.textContent.length < 80;

                            if (isTermValid) {
                                // Mark current node as DD
                                const classes = ['neko-dl-desc'];

                                // If the immediate previous node was empty, we need to pull up more
                                if (lastNode && lastNode.textContent.trim().length === 0) {
                                    classes.push('neko-dl-gap-fix');
                                }

                                decorations.push(
                                    Decoration.node(pos, pos + node.nodeSize, {
                                        class: classes.join(' '),
                                    })
                                );

                                // Mark previous node as DT
                                decorations.push(
                                    Decoration.node(lastNonEmptyPos, lastNonEmptyPos + lastNonEmptyNode!.nodeSize, {
                                        class: 'neko-dl-term',
                                    })
                                );
                            }
                        }
                        // Update tracking
                        lastNode = node;
                        if (!isEmpty) {
                            lastNonEmptyNode = node;
                            lastNonEmptyPos = pos;
                        }

                        return false;
                    }
                    return true;
                });

                return DecorationSet.create(state.doc, decorations);
            },
        },
    });
});

// Combined definition list plugin
export const deflistPlugin = [
    definitionListSchema,
    definitionTermSchema,
    definitionDescSchema,
    deflistVisualPlugin
];