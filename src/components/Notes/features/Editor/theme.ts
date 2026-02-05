/*
* Custom NekoTick Theme for Milkdown
* Replicates the visual style of modern block-based editors (1:1 visual match)
*/

import { rootCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';

// Class mappings for 1:1 visual replication
export const themeClasses = {
    root: 'prose mx-auto focus:outline-none min-h-[50vh] pb-32 pt-0',

    // Typography - Using Golden Spacing (26px) for Vertical Rhythm
    heading: {
        h1: 'scroll-m-20 text-[42px] leading-[1.2] font-extrabold tracking-tight mb-[26px] mt-[42px] first:mt-0 text-[var(--neko-text-primary)]',
        h2: 'scroll-m-20 pb-2 text-[33px] leading-[1.3] font-semibold tracking-tight transition-colors first:mt-0 mb-[26px] mt-[33px] text-[var(--neko-text-primary)]',
        h3: 'scroll-m-20 text-[26px] leading-[1.4] font-semibold tracking-tight mb-[16px] mt-[26px] text-[var(--neko-text-primary)]',
        h4: 'scroll-m-20 text-[20px] leading-[1.4] font-semibold tracking-tight mb-[10px] mt-[20px] text-[var(--neko-text-primary)]',
        h5: 'scroll-m-20 text-[16px] leading-[1.5] font-semibold tracking-tight mb-[10px] mt-[16px] text-[var(--neko-text-primary)]',
        h6: 'scroll-m-20 text-[13px] leading-[1.5] font-semibold tracking-tight mb-[10px] mt-[16px] text-[var(--neko-text-primary)]',
    },

    paragraph: 'leading-[26px] [&:not(:first-child)]:mt-[26px] text-[var(--neko-text-primary)] text-[16px]',

    // Text Formatting
    strong: 'font-semibold text-[var(--neko-text-primary)]',
    em: 'italic',
    code: 'relative rounded bg-[var(--neko-bg-tertiary)] px-[5px] py-[2.5px] font-mono text-[13px] font-medium text-[var(--neko-text-primary)] border border-[var(--neko-border)]', // 5px ~ 16/3.14
    link: 'font-medium text-[#1e96eb] underline underline-offset-4 cursor-pointer hover:text-[#0c7fd9] transition-colors',

    // Block Elements
    blockquote: 'mt-[26px] border-l-[4px] border-[#e0e0e0] dark:border-[#333333] pl-[26px] italic text-[var(--neko-text-secondary)]', // 4px = 16/4

    lists: {
        ul: 'my-[26px] ml-[26px] list-disc [&>li]:mt-2 marker:text-[var(--neko-text-secondary)]',
        ol: 'my-[26px] ml-[26px] list-decimal [&>li]:mt-2 marker:text-[var(--neko-text-secondary)]',
        li: 'pl-2',
        task: 'my-[26px] ml-0 list-none [&>li]:mt-2',
    },

    // Images & Media
    image: 'rounded-md border border-[var(--neko-border)] bg-[var(--neko-bg-tertiary)]',

    // Table
    table: 'w-full caption-bottom text-sm my-[26px] overflow-y-auto',
    thead: '[&_tr]:border-b border-[var(--neko-border)]',
    tbody: '[&_tr:last-child]:border-0',
    tr: 'border-b border-[var(--neko-border)] transition-colors hover:bg-[var(--neko-bg-hover)] data-[state=selected]:bg-[var(--neko-bg-tertiary)]',
    th: 'h-[42px] px-4 text-left align-middle font-medium text-[var(--neko-text-secondary)] bg-[var(--neko-bg-tertiary)]', // Matches H1/Grid
    td: 'p-4 align-middle [&:has([role=checkbox])]:pr-0',

    // Code Block
    fence: 'relative rounded-lg bg-[var(--neko-bg-secondary)] border border-[var(--neko-border)] my-[26px] font-mono text-[13px]',

    // Divider
    hr: 'my-[42px] border-[var(--neko-border)]', // Golden Section Break
};

import { headingSchema, paragraphSchema, strongSchema, emphasisSchema, inlineCodeSchema, linkSchema, blockquoteSchema, hrSchema, imageSchema } from '@milkdown/kit/preset/commonmark';
import { listItemSchema, bulletListSchema, orderedListSchema } from '@milkdown/kit/preset/commonmark';
import { tableSchema, tableRowSchema, tableHeaderSchema, tableCellSchema } from '@milkdown/kit/preset/gfm';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';

// Plugin to apply theme classes
export function configureTheme(ctx: Ctx) {
    return async () => {
        // Apply root classes
        ctx.update(rootCtx, (root: unknown) => {
            if (root instanceof HTMLElement) {
                root.classList.add(...themeClasses.root.split(' '));
            }
            return root as (HTMLElement | null);
        });

        // Typography & Blocks
        ctx.update(paragraphSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['p', { class: themeClasses.paragraph }, 0]
        }));

        ctx.update(headingSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (node: any) => {
                const level = node.attrs.level;
                const className = themeClasses.heading[`h${level}` as keyof typeof themeClasses.heading];
                return [`h${level}`, { class: className }, 0];
            }
        }));

        ctx.update(blockquoteSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['blockquote', { class: themeClasses.blockquote }, 0]
        }));

        ctx.update(hrSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['hr', { class: themeClasses.hr }]
        }));

        // Inline
        ctx.update(strongSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['strong', { class: themeClasses.strong }, 0]
        }));

        ctx.update(emphasisSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['em', { class: themeClasses.em }, 0]
        }));

        ctx.update(inlineCodeSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['code', { class: themeClasses.code }, 0]
        }));

        ctx.update(linkSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (node: any) => ['a', { ...node.attrs, class: themeClasses.link }, 0]
        }));

        // Lists
        ctx.update(bulletListSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['ul', { class: themeClasses.lists.ul }, 0]
        }));

        ctx.update(orderedListSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['ol', { class: themeClasses.lists.ol }, 0]
        }));

        ctx.update(listItemSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['li', { class: themeClasses.lists.li }, 0]
        }));

        // Code Block
        ctx.update(codeBlockSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (node: any) => ['div', { class: themeClasses.fence, 'data-language': node.attrs.language }, ['pre', ['code', { spellcheck: 'false' }, 0]]]
        }));

        ctx.update(imageSchema.key, (prev: any) => {
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
                        
                        state.write(`<img src="${srcStr}" alt="${altStr}"${attrsStr} />`);
                    }
                }
            };
        });

        // Table Nodes
        ctx.update(tableRowSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['tr', { class: themeClasses.tr }, 0]
        }));

        ctx.update(tableHeaderSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['th', { ..._node.attrs, class: themeClasses.th }, 0]
        }));

        ctx.update(tableCellSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['td', { ..._node.attrs, class: themeClasses.td }, 0]
        }));

        // Table Wrapper (already updated, keeping as is)
        ctx.update(tableSchema.key, (prev: any) => ({
            ...prev,
            toDOM: (_node: any) => ['table', { class: themeClasses.table }, ['tbody', 0]]
        }));
    };
}