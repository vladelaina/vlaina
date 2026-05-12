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
import { normalizeImageWidth } from './plugins/image-block/utils/imageSourceFragment';
import { escapeHtmlAttr, getDomAttrs, updateSchemaFactory } from './themeSchemaUtils';

interface MarkdownHtmlImageAttrs {
    src: string;
    alt: string;
    title: string | null;
    align: string;
    width: string | null;
    wrapInParagraph: boolean;
}

const markdownHtmlImageWrapperTags = new Set(['a', 'center', 'div', 'figure', 'p', 'picture', 'span']);

function getSignificantChildren(parent: ParentNode): ChildNode[] {
    return Array.from(parent.childNodes).filter((child) => {
        if (child.nodeType === Node.TEXT_NODE) return (child.textContent ?? '').trim() !== '';
        return child.nodeType === Node.ELEMENT_NODE;
    });
}

function getOnlyElementChild(parent: ParentNode): Element | null {
    const children = getSignificantChildren(parent);
    return children.length === 1 && children[0].nodeType === Node.ELEMENT_NODE
        ? children[0] as Element
        : null;
}

function getOnlyPictureImage(element: Element): HTMLImageElement | null {
    const children = Array.from(element.childNodes).filter((child) => {
        if (child.nodeType === Node.TEXT_NODE) return (child.textContent ?? '').trim() !== '';
        if (child.nodeType !== Node.ELEMENT_NODE) return false;
        return (child as Element).tagName.toLowerCase() !== 'source';
    });

    if (children.length !== 1 || children[0].nodeType !== Node.ELEMENT_NODE) return null;
    const image = children[0] as Element;
    return image.tagName.toLowerCase() === 'img' ? image as HTMLImageElement : null;
}

function getHtmlTextAlign(element: Element): string | null {
    const align = element.getAttribute('align');
    if (align) return align;
    const styleAlign = (element as HTMLElement).style?.textAlign;
    return styleAlign || null;
}

function getImageWidth(image: HTMLImageElement): string | null {
    return normalizeImageWidth(
        image.getAttribute('width') ||
        image.style?.width ||
        image.style?.maxWidth
    );
}

function findSingleMarkdownHtmlImage(
    element: Element,
    context: { align: string | null; wrapInParagraph: boolean } = { align: null, wrapInParagraph: false }
): { image: HTMLImageElement; parentAlign: string | null; wrapInParagraph: boolean } | null {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'img') {
        return {
            image: element as HTMLImageElement,
            parentAlign: context.align,
            wrapInParagraph: context.wrapInParagraph,
        };
    }

    if (!markdownHtmlImageWrapperTags.has(tagName)) return null;

    const nextContext = {
        align: getHtmlTextAlign(element) || context.align,
        wrapInParagraph: context.wrapInParagraph || tagName !== 'a',
    };

    const child = tagName === 'picture'
        ? getOnlyPictureImage(element)
        : getOnlyElementChild(element);
    if (!child) return null;

    return findSingleMarkdownHtmlImage(child, nextContext);
}

function getMarkdownHtmlImageElement(value: string): { image: HTMLImageElement; parentAlign: string | null; wrapInParagraph: boolean } | null {
    const template = document.createElement('template');
    template.innerHTML = value.trim();

    const rootElement = getOnlyElementChild(template.content);
    if (!rootElement) return null;
    return findSingleMarkdownHtmlImage(rootElement);
}

function getMarkdownHtmlImageAttrs(value: string): MarkdownHtmlImageAttrs | null {
    const result = getMarkdownHtmlImageElement(value);
    if (!result) return null;

    const safeSrc = sanitizeNoteMediaSrc(result.image.getAttribute('src'));
    if (!safeSrc) return null;

    return {
        src: safeSrc,
        alt: result.image.getAttribute('alt') ?? '',
        title: result.image.getAttribute('title'),
        width: getImageWidth(result.image),
        align: result.image.getAttribute('align') || result.parentAlign || 'center',
        wrapInParagraph: result.wrapInParagraph,
    };
}

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
            width: { default: null }
        },
        toDOM: (node: any) => {
            const safeSrc = sanitizeNoteMediaSrc(node.attrs.src);
            const width = normalizeImageWidth(node.attrs.width);
            return ['img', {
                src: safeSrc || undefined,
                alt: node.attrs.alt,
                title: node.attrs.title,
                align: node.attrs.align,
                width,
            }];
        },
        parseDOM: [
            ...(prev.parseDOM || []),
            {
                tag: 'img[src]',
                getAttrs: (dom: HTMLElement) => {
                    const safeSrc = sanitizeNoteMediaSrc(dom.getAttribute('src'));
                    if (!safeSrc) return false;
                    return {
                        src: safeSrc,
                        alt: dom.getAttribute('alt'),
                        title: dom.getAttribute('title'),
                        align: dom.getAttribute('align') || 'center',
                        width: normalizeImageWidth(dom.getAttribute('width'))
                    };
                }
            }
        ],
        parseMarkdown: {
            match: (node: any) => {
                if (node.type === 'html' && typeof node.value === 'string')
                    return getMarkdownHtmlImageElement(node.value) !== null;
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
                    width: null
                });
            }
        },
        toMarkdown: {
            match: (node: any) => node.type.name === 'image',
            runner: (state: any, node: any) => {
                const { src, alt, title, align, width } = node.attrs;
                const safeSrc = sanitizeNoteMediaSrc(src);
                if (!safeSrc) return;
                const safeWidth = normalizeImageWidth(width);

                const hasCustomAlign = align && align !== 'center';
                const hasCustomWidth = safeWidth && safeWidth !== '';

                if (!hasCustomAlign && !hasCustomWidth) {
                    state.addNode('image', undefined, undefined, {
                        title: title || undefined,
                        url: safeSrc,
                        alt: alt || undefined,
                    });
                    return;
                }

                const attrs: string[] = [];
                if (hasCustomWidth) attrs.push(`width="${escapeHtmlAttr(safeWidth)}"`);
                if (hasCustomAlign) attrs.push(`align="${escapeHtmlAttr(align)}"`);
                if (title) attrs.push(`title="${escapeHtmlAttr(title)}"`);

                const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
                const srcStr = escapeHtmlAttr(safeSrc);
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
