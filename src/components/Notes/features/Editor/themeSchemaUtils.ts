import type { Ctx } from '@milkdown/kit/ctx';
import { isTextAlignment } from './plugins/floating-toolbar/blockAlignmentMarkdown';
import type { TextAlignment } from './plugins/floating-toolbar/types';

export function normalizeTextAlignment(value: unknown): TextAlignment {
    return isTextAlignment(value) ? value : 'left';
}

export function getAlignedBlockDomAttrs(align: unknown) {
    const normalizedAlign = normalizeTextAlignment(align);
    const attrs: Record<string, string> = {};

    if (normalizedAlign !== 'left') {
        attrs['data-text-align'] = normalizedAlign;
        attrs.style = `text-align: ${normalizedAlign}`;
    }

    return attrs;
}

export function getDomAttrs(attrs: Record<string, string | undefined> = {}) {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }

    return result;
}

export function getDomTextAlignment(dom: HTMLElement): TextAlignment {
    return normalizeTextAlignment(
        dom.getAttribute('data-text-align') ||
        dom.style.textAlign ||
        dom.getAttribute('align')
    );
}

export function updateSchemaFactory(
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

export function escapeHtmlAttr(value: string): string {
    if (!value) return '';
    return value
        .replace(/&/g, '&amp;')
        .replace(/\|/g, '&#124;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
