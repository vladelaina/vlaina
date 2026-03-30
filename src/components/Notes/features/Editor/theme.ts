/*
* Custom vlaina Theme for Milkdown
* Replicates the visual style of modern block-based editors (1:1 visual match)
*/

import { rootCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import {
    getTextAlignmentComment,
    isTextAlignment,
    readMarkdownNodeAlignment,
} from './plugins/floating-toolbar/blockAlignmentMarkdown';
import type { TextAlignment } from './plugins/floating-toolbar/types';

// Class mappings for 1:1 visual replication
export const themeClasses = {
    root: 'prose mx-auto focus:outline-none min-h-[50vh] pb-32 pt-0',

    heading: {
        h1: 'text-[var(--vlaina-text-primary)]',
        h2: 'text-[var(--vlaina-text-primary)]',
        h3: 'text-[var(--vlaina-text-primary)]',
        h4: 'text-[var(--vlaina-text-primary)]',
        h5: 'text-[var(--vlaina-text-primary)]',
        h6: 'text-[var(--vlaina-text-primary)]',
    },

    paragraph: 'text-[var(--vlaina-text-primary)]',

    // Text Formatting
    strong: 'font-semibold text-[var(--vlaina-text-primary)]',
    em: 'italic',
    code: 'inline-block align-baseline rounded bg-neutral-100 px-1 py-0.5 font-mono text-sm font-medium text-neutral-800 caret-[var(--vlaina-caret-color)] dark:bg-neutral-800 dark:text-neutral-100', 
    link: 'font-medium text-[#1e96eb] underline underline-offset-4 cursor-pointer hover:text-[#0c7fd9] transition-colors',

    // Block Elements
    blockquote: 'mt-[26px] pl-[26px] text-[var(--vlaina-text-secondary)]',

    lists: {
        ul: 'my-[26px] ml-[26px] list-disc [&>li]:mt-2 marker:text-[var(--vlaina-text-secondary)]',
        ol: 'my-[26px] ml-[26px] list-decimal [&>li]:mt-2 marker:text-[var(--vlaina-text-secondary)]',
        li: 'pl-2',
        task: 'my-[26px] ml-0 list-none [&>li]:mt-2',
    },

    // Images & Media
    image: 'rounded-md border border-[var(--vlaina-border)] bg-[var(--vlaina-bg-tertiary)]',

    // Table
    table: 'w-max max-w-full caption-bottom text-sm my-0 overflow-y-auto',
    thead: '[&_tr]:border-b border-[var(--vlaina-border)]',
    tbody: '[&_tr:last-child]:border-0',
    tr: 'border-b border-[var(--vlaina-border)] transition-colors hover:bg-[var(--vlaina-bg-hover)] data-[state=selected]:bg-[var(--vlaina-bg-tertiary)]',
    th: 'h-[42px] px-4 text-left align-middle font-medium text-[var(--vlaina-text-secondary)] bg-[var(--vlaina-bg-tertiary)]', // Matches H1/Grid
    td: 'p-4 align-middle [&:has([role=checkbox])]:pr-0',

    // Code Block
    fence: 'relative rounded-lg bg-[var(--vlaina-bg-secondary)] border border-[var(--vlaina-border)] my-[26px] font-mono text-[13px]',

    // Divider
    hr: 'my-0 border-0 h-0',
};

import { headingSchema, paragraphSchema, strongSchema, emphasisSchema, inlineCodeSchema, linkSchema, blockquoteSchema, hrSchema, imageSchema } from '@milkdown/kit/preset/commonmark';
import { listItemSchema, bulletListSchema, orderedListSchema } from '@milkdown/kit/preset/commonmark';
import { tableSchema, tableRowSchema, tableHeaderSchema, tableCellSchema } from '@milkdown/kit/preset/gfm';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';

function normalizeTextAlignment(value: unknown): TextAlignment {
    return isTextAlignment(value) ? value : 'left';
}

function getAlignedBlockDomAttrs(className: string, align: unknown) {
    const normalizedAlign = normalizeTextAlignment(align);
    const attrs: Record<string, string> = { class: className };

    if (normalizedAlign !== 'left') {
        attrs['data-text-align'] = normalizedAlign;
        attrs.style = `text-align: ${normalizedAlign}`;
    }

    return attrs;
}

function getDomTextAlignment(dom: HTMLElement): TextAlignment {
    return normalizeTextAlignment(
        dom.getAttribute('data-text-align') ||
        dom.style.textAlign ||
        dom.getAttribute('align')
    );
}

function updateSchemaFactory(
    ctx: Ctx,
    key: string,
    updater: (prev: any, innerCtx: Ctx) => any
) {
    ctx.update(key as any, (prev: any) => {
        if (typeof prev !== 'function') {
            return prev;
        }

        return (innerCtx: Ctx) => updater(prev(innerCtx), innerCtx);
    });
}

function applyRootThemeClasses(ctx: Ctx) {
    ctx.update(rootCtx, (root: unknown) => {
        if (root instanceof HTMLElement) {
            root.classList.add(...themeClasses.root.split(' '));
        }
        return root as (HTMLElement | null);
    });
}

function applySchemaThemeOverrides(ctx: Ctx) {
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

    updateSchemaFactory(ctx, bulletListSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['ul', { class: themeClasses.lists.ul }, 0]
    }));

    updateSchemaFactory(ctx, orderedListSchema.key, (prev: any) => ({
        ...prev,
        parseMarkdown: {
            match: ({ type, ordered }: { type: string; ordered?: boolean }) => type === 'list' && !!ordered,
            runner: (state: any, node: any, type: any) => {
                const spread = node.spread != null ? `${node.spread}` : 'true';
                const order = typeof node.start === 'number' ? node.start : 1;
                state.openNode(type, { spread, order }).next(node.children).closeNode();
            },
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'ordered_list',
            runner: (state: any, node: any) => {
                state.openNode('list', undefined, {
                    ordered: true,
                    start: typeof node.attrs.order === 'number' ? node.attrs.order : 1,
                    spread: node.attrs.spread === 'true' || node.attrs.spread === true,
                });
                state.next(node.content);
                state.closeNode();
            },
        },
        toDOM: (node: any) => {
            const order = typeof node.attrs?.order === 'number' ? node.attrs.order : 1;
            return [
                'ol',
                {
                    class: themeClasses.lists.ol,
                    ...(order !== 1 ? { start: String(order) } : {}),
                },
                0,
            ];
        }
    }));

    updateSchemaFactory(ctx, listItemSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => {
            const label = typeof node.attrs.label === 'string' ? node.attrs.label : '';
            const numericValue = node.attrs.listType === 'ordered'
                ? Number.parseInt(label, 10)
                : Number.NaN;

            return ['li', {
                class: themeClasses.lists.li,
                'data-label': node.attrs.label,
                'data-list-type': node.attrs.listType,
                'data-spread': node.attrs.spread,
                ...(Number.isFinite(numericValue) ? { value: String(numericValue) } : {}),
            }, 0];
        }
    }));

    updateSchemaFactory(ctx, codeBlockSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (node: any) => ['div', { class: themeClasses.fence, 'data-language': node.attrs.language }, ['pre', ['code', { spellcheck: 'false' }, 0]]]
    }));

    updateSchemaFactory(ctx, imageSchema.key, (prev: any) => {
        const escapeHtml = (str: string) => {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        return {
            ...prev,
            attrs: {
                src: { default: null },
                alt: { default: null },
                title: { default: null },
                align: { default: 'center' },
                width: { default: null }
            },
            toDOM: (node: any) => {
                return ['img', {
                    src: node.attrs.src,
                    alt: node.attrs.alt,
                    title: node.attrs.title,
                    align: node.attrs.align,
                    width: node.attrs.width,
                    class: themeClasses.image
                }];
            },
            parseDOM: prev.parseDOM ? [
                ...prev.parseDOM,
                {
                    tag: 'img[src]',
                    getAttrs: (dom: HTMLElement) => ({
                        src: dom.getAttribute('src'),
                        alt: dom.getAttribute('alt'),
                        title: dom.getAttribute('title'),
                        align: dom.getAttribute('align') || 'center',
                        width: dom.getAttribute('width') || null
                    })
                }
            ] : [{
                tag: 'img[src]',
                getAttrs: (dom: HTMLElement) => ({
                    src: dom.getAttribute('src'),
                    alt: dom.getAttribute('alt'),
                    title: dom.getAttribute('title'),
                    align: dom.getAttribute('align') || 'center',
                    width: dom.getAttribute('width') || null
                })
            }],
            parseMarkdown: {
                match: (node: any) => {
                    if (node.type === 'html' && typeof node.value === 'string') {
                        return node.value.trim().startsWith('<img');
                    }
                    return node.type === 'image';
                },
                runner: (state: any, node: any, type: any) => {
                    if (node.type === 'html') {
                        const html = node.value as string;
                        const srcMatch = html.match(/src=["']([^"']+)["']/);
                        const altMatch = html.match(/alt=["']([^"']*)["']/);
                        const widthMatch = html.match(/width=["']([^"']+)["']/);
                        const alignMatch = html.match(/align=["']([^"']+)["']/);
                        const titleMatch = html.match(/title=["']([^"']+)["']/);

                        if (srcMatch) {
                            state.addNode(type, {
                                src: srcMatch[1],
                                alt: altMatch ? altMatch[1] : '',
                                title: titleMatch ? titleMatch[1] : null,
                                width: widthMatch ? widthMatch[1] : null,
                                align: alignMatch ? alignMatch[1] : 'center',
                            });
                        }
                    } else if (node.type === 'image') {
                        state.addNode(type, {
                            src: node.url,
                            alt: node.alt || '',
                            title: node.title || null,
                            align: 'center',
                            width: null
                        });
                    }
                }
            },
            toMarkdown: {
                match: (node: any) => node.type.name === 'image',
                runner: (state: any, node: any) => {
                    const { src, alt, title, align, width } = node.attrs;

                    const hasCustomAlign = align && align !== 'center';
                    const hasCustomWidth = width && width !== '';

                    if (!hasCustomAlign && !hasCustomWidth) {
                        state.addNode('image', undefined, undefined, {
                            title: title || undefined,
                            url: src || '',
                            alt: alt || undefined,
                        });
                        return;
                    }

                    const attrs: string[] = [];
                    if (hasCustomWidth) attrs.push(`width="${escapeHtml(width)}"`);
                    if (hasCustomAlign) attrs.push(`align="${escapeHtml(align)}"`);
                    if (title) attrs.push(`title="${escapeHtml(title)}"`);

                    const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
                    const srcStr = escapeHtml(src || '');
                    const altStr = escapeHtml(alt || '');

                    state.addNode('html', undefined, `<img src="${srcStr}" alt="${altStr}"${attrsStr} />`);
                }
            }
        };
    });

    updateSchemaFactory(ctx, tableRowSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['tr', { class: themeClasses.tr }, 0]
    }));

    updateSchemaFactory(ctx, tableHeaderSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['th', { ..._node.attrs, class: themeClasses.th }, 0]
    }));

    updateSchemaFactory(ctx, tableCellSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['td', { ..._node.attrs, class: themeClasses.td }, 0]
    }));

    updateSchemaFactory(ctx, tableSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['table', { class: themeClasses.table }, ['tbody', 0]]
    }));
}

// Plugin to apply theme classes
export function configureTheme(ctx: Ctx) {
    applySchemaThemeOverrides(ctx);

    return async () => {
        applyRootThemeClasses(ctx);
    };
}
