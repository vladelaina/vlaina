import type { Ctx } from '@milkdown/kit/ctx';
import {
    codeBlockSchema,
    headingSchema,
    linkSchema,
    paragraphSchema,
} from '@milkdown/kit/preset/commonmark';
import {
    getTextAlignmentComment,
    readMarkdownNodeAlignment,
} from './plugins/floating-toolbar/blockAlignmentMarkdown';
import { sanitizeNoteLinkHref } from '@/lib/notes/markdown/urlSecurity';
import {
    getAlignedBlockDomAttrs,
    getDomAttrs,
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
            getAlignedBlockDomAttrs(node.attrs.align),
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
            return [`h${level}`, getAlignedBlockDomAttrs(node.attrs.align), 0];
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

    updateSchemaFactory(ctx, linkSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => {
            const safeHref = sanitizeNoteLinkHref(node.attrs.href);
            return ['a', getDomAttrs({ ...node.attrs, href: safeHref ?? undefined }), 0];
        }
    }));

    updateSchemaFactory(ctx, codeBlockSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => [
            'div',
            getDomAttrs({ 'data-language': node.attrs.language }),
            ['pre', ['code', { spellcheck: 'false' }, 0]]
        ]
    }));
}
