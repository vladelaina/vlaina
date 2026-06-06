import { sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';
import {
    normalizeImageWidth,
    serializeCropValue,
} from './plugins/image-block/utils/imageSourceFragment';
import { normalizeImageAlignment } from './plugins/image-block/utils/imageNodeAttrs';

const MAX_MARKDOWN_HTML_IMAGE_CHARS = 64 * 1024;
const MAX_MARKDOWN_HTML_IMAGE_WRAPPER_DEPTH = 32;
export const MAX_MARKDOWN_HTML_IMAGE_CHILD_SCAN_NODES = 1024;

export interface MarkdownHtmlImageAttrs {
    src: string;
    alt: string;
    title: string | null;
    align: string;
    width: string | null;
    crop: string | null;
    wrapInParagraph: boolean;
}

const markdownHtmlImageWrapperTags = new Set(['a', 'center', 'div', 'figure', 'p', 'picture', 'span']);

function getOnlyElementChild(parent: ParentNode): Element | null {
    let elementChild: Element | null = null;
    const childCount = Math.min(parent.childNodes.length, MAX_MARKDOWN_HTML_IMAGE_CHILD_SCAN_NODES);
    for (let index = 0; index < childCount; index += 1) {
        const child = parent.childNodes.item(index);
        if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() === '') continue;
        if (child.nodeType !== Node.ELEMENT_NODE) return null;
        if (elementChild) return null;
        elementChild = child as Element;
    }

    return parent.childNodes.length <= MAX_MARKDOWN_HTML_IMAGE_CHILD_SCAN_NODES ? elementChild : null;
}

function getOnlyPictureImage(element: Element): HTMLImageElement | null {
    let imageChild: Element | null = null;
    const childCount = Math.min(element.childNodes.length, MAX_MARKDOWN_HTML_IMAGE_CHILD_SCAN_NODES);
    for (let index = 0; index < childCount; index += 1) {
        const child = element.childNodes.item(index);
        if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() === '') continue;
        if (child.nodeType !== Node.ELEMENT_NODE) return null;
        if ((child as Element).tagName.toLowerCase() === 'source') continue;
        if (imageChild) return null;
        imageChild = child as Element;
    }

    if (element.childNodes.length > MAX_MARKDOWN_HTML_IMAGE_CHILD_SCAN_NODES || !imageChild) return null;
    const image = imageChild;
    return image.tagName.toLowerCase() === 'img' ? image as HTMLImageElement : null;
}

function getHtmlTextAlign(element: Element): string | null {
    const align = normalizeImageAlignment(element.getAttribute('align'));
    if (align) return align;
    const styleAlign = (element as HTMLElement).style?.textAlign;
    return normalizeImageAlignment(styleAlign);
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
    context: { align: string | null; wrapInParagraph: boolean } = { align: null, wrapInParagraph: false },
    depth = 1
): { image: HTMLImageElement; parentAlign: string | null; wrapInParagraph: boolean } | null {
    if (depth > MAX_MARKDOWN_HTML_IMAGE_WRAPPER_DEPTH) return null;

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

    return findSingleMarkdownHtmlImage(child, nextContext, depth + 1);
}

function getMarkdownHtmlImageElement(value: string): { image: HTMLImageElement; parentAlign: string | null; wrapInParagraph: boolean } | null {
    if (value.length > MAX_MARKDOWN_HTML_IMAGE_CHARS) return null;

    const template = document.createElement('template');
    template.innerHTML = value.trim();

    const rootElement = getOnlyElementChild(template.content);
    if (!rootElement) return null;
    return findSingleMarkdownHtmlImage(rootElement);
}

export function getMarkdownHtmlImageAttrs(value: string): MarkdownHtmlImageAttrs | null {
    const result = getMarkdownHtmlImageElement(value);
    if (!result) return null;

    const safeSrc = sanitizeNoteMediaSrc(result.image.getAttribute('src'));
    if (!safeSrc) return null;

    return {
        src: safeSrc,
        alt: result.image.getAttribute('alt') ?? '',
        title: result.image.getAttribute('title'),
        width: getImageWidth(result.image),
        crop: serializeCropValue(result.image.getAttribute('data-vlaina-crop')),
        align: normalizeImageAlignment(result.image.getAttribute('align'))
            || normalizeImageAlignment(result.parentAlign)
            || 'center',
        wrapInParagraph: result.wrapInParagraph,
    };
}
