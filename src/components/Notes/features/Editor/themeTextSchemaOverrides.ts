import type { Ctx } from '@milkdown/kit/ctx';
import {
    blockquoteSchema,
    codeBlockSchema,
    emphasisSchema,
    headingSchema,
    hrSchema,
    inlineCodeSchema,
    linkSchema,
    paragraphSchema,
    strongSchema,
} from '@milkdown/kit/preset/commonmark';
import {
    getTextAlignmentComment,
    readMarkdownNodeAlignment,
} from './plugins/floating-toolbar/blockAlignmentMarkdown';
import { themeClasses } from './themeClasses';
import {
    getAlignedBlockDomAttrs,
    getDomTextAlignment,
    normalizeTextAlignment,
    updateSchemaFactory,
} from './themeSchemaUtils';

export function applyTextSchemaOverrides(ctx: Ctx) {
    updateSchemaFactory(ctx, paragraphSchema.key, (prev: any) => ({
        ...prev,
        attrs: {
            ...(prev.attrs || {}),
            align: { default: 'left' },
        },
        toDOM: (node: any) => [
            'p',
            getAlignedBlockDomAttrs(themeClasses.paragraph, node.attrs.align),
            0
        ],
        parseDOM: [
            {
                tag: 'p',
                getAttrs: (dom: HTMLElement) => ({
                    align: getDomTextAlignment(dom),
                }),
            },
            ...(prev.parseDOM || []),
        ],
        parseMarkdown: {
            match: (node: any) => node.type === 'paragraph',
            runner: (state: any, node: any, type: any) => {
                const align = readMarkdownNodeAlignment(node);
                state.openNode(type, align !== 'left' ? { align } : undefined);
                state.next(node.children);
                state.closeNode();
            },
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'paragraph',
            runner: (state: any, node: any) => {
                const align = normalizeTextAlignment(node.attrs.align);
                prev.toMarkdown.runner(state, node);
                if (align !== 'left') {
                    state.addNode('html', undefined, getTextAlignmentComment(align));
                }
            },
        },
    }));

    updateSchemaFactory(ctx, headingSchema.key, (prev: any) => ({
        ...prev,
        attrs: {
            ...(prev.attrs || {}),
            align: { default: 'left' },
        },
        toDOM: (node: any) => {
            const level = node.attrs.level;
            const className = themeClasses.heading[`h${level}` as keyof typeof themeClasses.heading];
            return [`h${level}`, getAlignedBlockDomAttrs(className, node.attrs.align), 0];
        },
        parseDOM: [
            ...Array.from({ length: 6 }, (_, index) => ({
                tag: `h${index + 1}`,
                getAttrs: (dom: HTMLElement) => ({
                    level: index + 1,
                    align: getDomTextAlignment(dom),
                }),
            })),
            ...(prev.parseDOM || []),
        ],
        parseMarkdown: {
            match: (node: any) => node.type === 'heading',
            runner: (state: any, node: any, type: any) => {
                const align = readMarkdownNodeAlignment(node);
                const attrs = align !== 'left'
                    ? { level: node.depth, align }
                    : { level: node.depth };
                state.openNode(type, attrs);
                state.next(node.children);
                state.closeNode();
            },
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'heading',
            runner: (state: any, node: any) => {
                const align = normalizeTextAlignment(node.attrs.align);
                prev.toMarkdown.runner(state, node);
                if (align !== 'left') {
                    state.addNode('html', undefined, getTextAlignmentComment(align));
                }
            },
        },
    }));

    updateSchemaFactory(ctx, blockquoteSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['blockquote', { class: themeClasses.blockquote }, 0]
    }));

    updateSchemaFactory(ctx, hrSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['hr', { class: themeClasses.hr }]
    }));

    updateSchemaFactory(ctx, strongSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['strong', { class: themeClasses.strong }, 0]
    }));

    updateSchemaFactory(ctx, emphasisSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['em', { class: themeClasses.em }, 0]
    }));

    updateSchemaFactory(ctx, inlineCodeSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['code', { class: themeClasses.code }, 0]
    }));

    updateSchemaFactory(ctx, linkSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => ['a', { ...node.attrs, class: themeClasses.link }, 0]
    }));

    updateSchemaFactory(ctx, codeBlockSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => [
            'div',
            { class: themeClasses.fence, 'data-language': node.attrs.language },
            ['pre', ['code', { spellcheck: 'false' }, 0]]
        ]
    }));
}
