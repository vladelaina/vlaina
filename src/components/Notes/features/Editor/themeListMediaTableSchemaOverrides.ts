import type { Ctx } from '@milkdown/kit/ctx';
import {
    imageSchema,
    listItemSchema,
    orderedListSchema,
} from '@milkdown/kit/preset/commonmark';
import {
    tableCellSchema,
    tableHeaderSchema,
} from '@milkdown/kit/preset/gfm';
import { sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';
import {
    normalizeImageWidth,
    parseCropValue,
    serializeCropValue,
} from './plugins/image-block/utils/imageSourceFragment';
import { normalizeImageAlignment } from './plugins/image-block/utils/imageNodeAttrs';
import { getMarkdownHtmlImageAttrs } from './markdownHtmlImage';
import { escapeHtmlAttr, getDomAttrs, updateSchemaFactory } from './themeSchemaUtils';

export function applyListMediaTableSchemaOverrides(ctx: Ctx) {
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
                getDomAttrs({
                    ...(order !== 1 ? { start: String(order) } : {}),
                }),
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
            width: { default: null },
            crop: { default: null }
        },
        toDOM: (node: any) => {
            const safeSrc = sanitizeNoteMediaSrc(node.attrs.src);
            const width = normalizeImageWidth(node.attrs.width);
            const crop = serializeCropValue(node.attrs.crop);
            const align = normalizeImageAlignment(node.attrs.align);
            return ['img', {
                src: safeSrc || undefined,
                alt: node.attrs.alt,
                title: node.attrs.title,
                align: align || 'center',
                width,
                'data-vlaina-crop': crop || undefined,
            }];
        },
        parseDOM: [
            {
                tag: 'img[src]',
                getAttrs: (dom: HTMLElement) => {
                    const safeSrc = sanitizeNoteMediaSrc(dom.getAttribute('src'));
                    if (!safeSrc) return false;
                    return {
                        src: safeSrc,
                        alt: dom.getAttribute('alt'),
                        title: dom.getAttribute('title'),
                        align: normalizeImageAlignment(dom.getAttribute('align')) || 'center',
                        width: normalizeImageWidth(dom.getAttribute('width')),
                        crop: parseCropValue(dom.getAttribute('data-vlaina-crop')),
                    };
                }
            },
            ...(prev.parseDOM || [])
        ],
        parseMarkdown: {
            match: (node: any) => {
                if (node.type === 'html' && typeof node.value === 'string')
                    return getMarkdownHtmlImageAttrs(node.value) !== null;
                return node.type === 'image';
            },
            runner: (state: any, node: any, type: any) => {
                if (node.type === 'html') {
                    const attrs = getMarkdownHtmlImageAttrs(node.value as string);
                    if (attrs) {
                        const { wrapInParagraph, ...imageAttrs } = attrs;
                        const shouldWrapInParagraph = wrapInParagraph && state.top()?.type?.name !== 'paragraph';
                        if (shouldWrapInParagraph) state.openNode(state.schema.nodes.paragraph);
                        state.addNode(type, imageAttrs);
                        if (shouldWrapInParagraph) state.closeNode();
                    }
                    return;
                }

                const safeSrc = sanitizeNoteMediaSrc(node.url);
                if (!safeSrc) return;
                state.addNode(type, {
                    src: safeSrc,
                    alt: node.alt || '',
                    title: node.title || null,
                    align: 'center',
                    width: null,
                    crop: null,
                });
            }
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'image',
            runner: (state: any, node: any) => {
                const { src, alt, title, align, width, crop } = node.attrs;
                const safeSrc = sanitizeNoteMediaSrc(src);
                if (!safeSrc) return;
                const srcStr = escapeHtmlAttr(safeSrc);
                const effectiveAlign = normalizeImageAlignment(align);
                const safeWidth = normalizeImageWidth(width);
                const safeCrop = serializeCropValue(crop);

                const hasCustomWidth = safeWidth && safeWidth !== '';
                const hasCustomAlign = effectiveAlign && effectiveAlign !== 'center';

                const attrs: string[] = [];
                if (hasCustomWidth) attrs.push(`width="${escapeHtmlAttr(safeWidth)}"`);
                if (hasCustomAlign) attrs.push(`align="${escapeHtmlAttr(effectiveAlign)}"`);
                if (safeCrop) attrs.push(`data-vlaina-crop="${escapeHtmlAttr(safeCrop)}"`);
                if (title) attrs.push(`title="${escapeHtmlAttr(title)}"`);

                const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
                const altStr = escapeHtmlAttr(alt || '');

                state.addNode('html', undefined, `<img src="${srcStr}" alt="${altStr}"${attrsStr} />`);
            }
        }
    }));

    updateSchemaFactory(ctx, tableHeaderSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['th', getDomAttrs(_node.attrs), 0]
    }));

    updateSchemaFactory(ctx, tableCellSchema.key, (prev: any) => ({
        ...prev,
        toDOM: (_node: any) => ['td', getDomAttrs(_node.attrs), 0]
    }));
}
