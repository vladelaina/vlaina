import type { Ctx } from '@milkdown/kit/ctx';
import {
    blockquoteSchema,
    codeBlockSchema,
    headingSchema,
    htmlBlockSchema,
    htmlSchema,
    inlineCodeSchema,
    hrSchema,
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
    mergeDomClassNames,
    normalizeTextAlignment,
    updateSchemaFactory,
} from './themeSchemaUtils';
import {
    readEscapedMarkdownBlockSyntax,
} from '@/components/common/markdown/escapedBlockSyntax';
import {
    getRawMarkdownHtmlValue,
    isLiteralInlineMarkdownHtmlElement,
    MARKDOWN_HTML_INLINE_CLASS,
    MARKDOWN_HTML_SOURCE_TEXT_CLASS,
    renderRawMarkdownHtmlValueIntoElement,
    sanitizeRawMarkdownHtmlValue,
} from './themeRawMarkdownHtml';
export {
    renderRawMarkdownHtmlValueIntoElement,
    sanitizeRawMarkdownHtmlValue,
    shouldRenderRawMarkdownHtmlValueAsLiteralText,
} from './themeRawMarkdownHtml';

function getHeadingCompatibilityClass(level: unknown): string {
    const normalizedLevel = typeof level === 'number' && level >= 1 && level <= 6 ? level : 1;
    return `HyperMD-header HyperMD-header-${normalizedLevel} cm-header cm-header-${normalizedLevel} cm-line`;
}

function isExternalLinkHref(href: string | null): boolean {
    return typeof href === 'string' && /^(?:https?:|mailto:|weixin:)/i.test(href.trim());
}

export function applyTextSchemaOverrides(ctx: Ctx) {
    updateSchemaFactory(ctx, paragraphSchema.key, (prev: any) => ({
        ...prev,
        attrs: {
            ...(prev.attrs || {}),
            align: { default: 'left' },
            vlainaEscapedBlockSyntax: { default: null },
        },
        toDOM: (node: any) => [
            'p',
            (() => {
                const attrs = getAlignedBlockDomAttrs(node.attrs.align);
                return {
                    ...attrs,
                    class: mergeDomClassNames(attrs.class, 'md-p cm-line'),
                };
            })(),
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
                const escapedBlockSyntax = readEscapedMarkdownBlockSyntax(node);
                const attrs = {
                    ...(align !== 'left' ? { align } : {}),
                    ...(escapedBlockSyntax ? { vlainaEscapedBlockSyntax: escapedBlockSyntax } : {}),
                };
                state.openNode(type, Object.keys(attrs).length > 0 ? attrs : undefined);
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
            const attrs = getAlignedBlockDomAttrs(node.attrs.align);
            return [`h${level}`, {
                ...attrs,
                class: mergeDomClassNames(attrs.class, getHeadingCompatibilityClass(level)),
            }, 0];
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
            const attrs = getDomAttrs({ ...node.attrs, href: safeHref ?? undefined });
            const isExternalLink = isExternalLinkHref(safeHref);
            const className = mergeDomClassNames(
                attrs.class,
                isExternalLink ? 'external-link' : 'internal-link'
            );

            if (className) {
                attrs.class = className;
            } else {
                delete attrs.class;
            }

            return ['a', attrs, 0];
        }
    }));

    updateSchemaFactory(ctx, htmlSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => {
            const safeValue = sanitizeRawMarkdownHtmlValue(node.attrs?.value);
            const dom = prev.toDOM({
                ...node,
                attrs: {
                    ...node.attrs,
                    value: safeValue,
                },
            });
            if (dom instanceof HTMLElement) {
                dom.classList.add(MARKDOWN_HTML_INLINE_CLASS);
                dom.classList.toggle(
                    MARKDOWN_HTML_SOURCE_TEXT_CLASS,
                    isLiteralInlineMarkdownHtmlElement(dom, safeValue),
                );
            }
            return dom;
        },
        parseMarkdown: {
            match: (node: any) => prev.parseMarkdown?.match?.(node) ?? node.type === 'html',
            runner: (state: any, node: any, type: any) => {
                const rawValue = getRawMarkdownHtmlValue(node.value);
                if (rawValue) state.addNode(type, { value: rawValue });
            },
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'html',
            runner: (state: any, node: any) => {
                const rawValue = getRawMarkdownHtmlValue(node.attrs?.value);
                if (rawValue) state.addNode('html', undefined, rawValue);
            },
        },
    }));

    updateSchemaFactory(ctx, inlineCodeSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (mark: any) => {
            const attrs = typeof prev.toDOM === 'function' ? prev.toDOM(mark)?.[1] : {};
            return ['code', {
                ...(typeof attrs === 'object' && attrs ? attrs : {}),
                class: mergeDomClassNames(
                    typeof attrs === 'object' && attrs ? attrs.class : undefined,
                    'v-std-code cm-inline-code'
                ),
            }, 0];
        },
    }));

    updateSchemaFactory(ctx, blockquoteSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => {
            const inheritedAttrs = typeof prev.toDOM === 'function' ? prev.toDOM(node)?.[1] : {};
            return ['blockquote', {
                ...(typeof inheritedAttrs === 'object' && inheritedAttrs ? inheritedAttrs : {}),
                class: mergeDomClassNames(
                    typeof inheritedAttrs === 'object' && inheritedAttrs ? inheritedAttrs.class : undefined,
                    'v-q HyperMD-quote cm-hmd-indent-in-quote cm-line'
                ),
            }, 0];
        },
    }));

    updateSchemaFactory(ctx, hrSchema.key, (prev: any) => ({
        ...prev,
        toDOM: () => [
            'div',
            {
                class: 'md-hr',
                'data-type': 'hr',
                contenteditable: 'false',
            },
            ['hr']
        ],
    }));

    updateSchemaFactory(ctx, codeBlockSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => [
            'div',
            getDomAttrs({ 'data-language': node.attrs.language }),
            ['pre', ['code', { spellcheck: 'false' }, 0]]
        ]
    }));

    updateSchemaFactory(ctx, htmlBlockSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => {
            const safeValue = sanitizeRawMarkdownHtmlValue(node.attrs?.value);
            const dom = prev.toDOM({
                ...node,
                attrs: {
                    ...node.attrs,
                    value: safeValue,
                },
            });
            if (dom instanceof HTMLElement) {
                dom.classList.add('md-htmlblock', 'md-htmlblock-container');
                renderRawMarkdownHtmlValueIntoElement(dom, safeValue);
            }
            return dom;
        },
        parseMarkdown: {
            match: (node: any) => prev.parseMarkdown?.match?.(node) ?? node.type === 'html',
            runner: (state: any, node: any, type: any) => {
                const rawValue = getRawMarkdownHtmlValue(node.value);
                if (rawValue) state.addNode(type, { value: rawValue });
            },
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'html_block',
            runner: (state: any, node: any) => {
                const rawValue = getRawMarkdownHtmlValue(node.attrs?.value);
                if (rawValue) state.addNode('html', undefined, rawValue);
            },
        },
    }));
}
