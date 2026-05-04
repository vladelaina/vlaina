import type { Ctx } from '@milkdown/kit/ctx';
import {
    bulletListSchema,
    imageSchema,
    listItemSchema,
    orderedListSchema,
} from '@milkdown/kit/preset/commonmark';
import {
    tableCellSchema,
    tableHeaderSchema,
    tableRowSchema,
    tableSchema,
} from '@milkdown/kit/preset/gfm';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import { themeClasses } from './themeClasses';
import { escapeHtmlAttr, updateSchemaFactory } from './themeSchemaUtils';

export function applyListMediaTableSchemaOverrides(ctx: Ctx) {
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

    updateSchemaFactory(ctx, imageSchema.key, (prev: any) => ({
        ...prev,
        attrs: {
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            align: { default: 'center' },
            width: { default: null }
        },
        toDOM: (node: any) => ['img', {
            src: node.attrs.src,
            alt: node.attrs.alt,
            title: node.attrs.title,
            align: node.attrs.align,
            width: node.attrs.width,
            class: themeClasses.image
        }],
        parseDOM: [
            ...(prev.parseDOM || []),
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
        ],
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
                            src: decodeMarkdownHtmlText(srcMatch[1]),
                            alt: altMatch ? decodeMarkdownHtmlText(altMatch[1]) : '',
                            title: titleMatch ? decodeMarkdownHtmlText(titleMatch[1]) : null,
                            width: widthMatch ? widthMatch[1] : null,
                            align: alignMatch ? alignMatch[1] : 'center',
                        });
                    }
                    return;
                }

                state.addNode(type, {
                    src: node.url,
                    alt: node.alt || '',
                    title: node.title || null,
                    align: 'center',
                    width: null
                });
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
                if (hasCustomWidth) attrs.push(`width="${escapeHtmlAttr(width)}"`);
                if (hasCustomAlign) attrs.push(`align="${escapeHtmlAttr(align)}"`);
                if (title) attrs.push(`title="${escapeHtmlAttr(title)}"`);

                const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
                const srcStr = escapeHtmlAttr(src || '');
                const altStr = escapeHtmlAttr(alt || '');

                state.addNode('html', undefined, `<img src="${srcStr}" alt="${altStr}"${attrsStr} />`);
            }
        }
    }));

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
