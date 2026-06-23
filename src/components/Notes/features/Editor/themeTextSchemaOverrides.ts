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
import { sanitizeHtml } from './plugins/clipboard/sanitizer';

const MAX_RAW_MARKDOWN_HTML_CHARS = 2 * 1024 * 1024;
const PLAIN_UNCLOSED_HTML_BLOCK_START_PATTERN =
    /^(?: {0,3})<(div|blockquote|details|figure|section|article|aside|table|tbody|thead|tfoot|tr|td|th|ul|ol|li|dl|dt|dd|p|pre)>\n/i;
const RAW_MARKDOWN_HTML_COMMENT_PATTERN = /^<!--(?:(?!-->)[\s\S])*-->$/;
const RAW_MARKDOWN_ALIGNMENT_COMMENT_PATTERN = /^<!--\s*align\s*:\s*(?:left|center|right)\s*-->$/i;
const MARKDOWN_HTML_INLINE_CLASS = 'md-html-inline';
const MARKDOWN_HTML_SOURCE_TEXT_CLASS = 'md-html-source-text';

function getHeadingCompatibilityClass(level: unknown): string {
    const normalizedLevel = typeof level === 'number' && level >= 1 && level <= 6 ? level : 1;
    return `HyperMD-header HyperMD-header-${normalizedLevel} cm-header cm-header-${normalizedLevel} cm-line`;
}

function isExternalLinkHref(href: string | null): boolean {
    return typeof href === 'string' && /^(?:https?:|mailto:)/i.test(href.trim());
}

function isSafeInternalMarkdownHtmlValue(value: string): boolean {
    const trimmed = value.trim();
    return trimmed === '<!--vlaina-markdown-blank-line-->'
        || trimmed === '<!--vlaina-rendered-html-boundary-blank-line-->'
        || trimmed === '<!--vlaina-markdown-tight-heading-->';
}

function isNonRenderingMarkdownHtmlValue(value: string): boolean {
    const trimmed = value.trim();
    return /^<!--(?:(?!-->)[\s\S])*-->$/.test(trimmed)
        || /^<\?(?:(?!\?>)[\s\S])*\?>$/.test(trimmed)
        || /^<![A-Za-z][^>]*>$/.test(trimmed)
        || /^<!\[CDATA\[(?:(?!\]\]>)[\s\S])*\]\]>$/.test(trimmed);
}

function isSafeStaticMarkdownHtmlValue(value: string): boolean {
    const trimmed = value.trim();
    return /^<div\s+class\s*=\s*(?:"v-page-break"|'v-page-break')\s*>\s*<\/div>$/i.test(trimmed);
}

function isPlainUnclosedHtmlBlockStart(value: string): boolean {
    const tagName = PLAIN_UNCLOSED_HTML_BLOCK_START_PATTERN.exec(value)?.[1];
    return Boolean(tagName && !new RegExp(`</${tagName}\\s*>`, 'i').test(value));
}

export function sanitizeRawMarkdownHtmlValue(value: unknown): string {
    if (typeof value !== 'string') return '';
    if (value.length > MAX_RAW_MARKDOWN_HTML_CHARS) return '';
    if (
        isSafeInternalMarkdownHtmlValue(value)
        || isNonRenderingMarkdownHtmlValue(value)
        || isSafeStaticMarkdownHtmlValue(value)
    ) {
        return value.trim();
    }
    if (isPlainUnclosedHtmlBlockStart(value)) return value;
    return sanitizeHtml(value);
}

export function shouldRenderRawMarkdownHtmlValueAsLiteralText(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return RAW_MARKDOWN_HTML_COMMENT_PATTERN.test(trimmed)
        && !isSafeInternalMarkdownHtmlValue(trimmed)
        && !RAW_MARKDOWN_ALIGNMENT_COMMENT_PATTERN.test(trimmed);
}

export function renderRawMarkdownHtmlValueIntoElement(element: HTMLElement, value: string) {
    const renderAsLiteralText = shouldRenderRawMarkdownHtmlValueAsLiteralText(value);
    element.classList.toggle('md-htmlblock-literal-text', renderAsLiteralText);
    element.classList.toggle(MARKDOWN_HTML_SOURCE_TEXT_CLASS, renderAsLiteralText);
    element.dataset.value = value;
    if (renderAsLiteralText) {
        element.textContent = value;
    } else {
        element.innerHTML = value;
    }
}

function isLiteralInlineMarkdownHtmlElement(element: HTMLElement, value: string): boolean {
    return element.childNodes.length === 1
        && element.firstChild?.nodeType === Node.TEXT_NODE
        && element.textContent === value;
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
                const safeValue = sanitizeRawMarkdownHtmlValue(node.value);
                if (safeValue) state.addNode(type, { value: safeValue });
            },
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'html',
            runner: (state: any, node: any) => {
                const safeValue = sanitizeRawMarkdownHtmlValue(node.attrs?.value);
                if (safeValue) state.addNode('html', undefined, safeValue);
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
                const safeValue = sanitizeRawMarkdownHtmlValue(node.value);
                if (safeValue) state.addNode(type, { value: safeValue });
            },
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'html_block',
            runner: (state: any, node: any) => {
                const safeValue = sanitizeRawMarkdownHtmlValue(node.attrs?.value);
                if (safeValue) state.addNode('html', undefined, safeValue);
            },
        },
    }));
}
