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

export function getDomAttrs(attrs: Record<string, unknown> = {}) {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(attrs)) {
        if (typeof value === 'string') {
            result[key] = value;
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            result[key] = String(value);
        } else if (typeof value === 'boolean') {
            result[key] = String(value);
        }
    }

    return result;
}

export function mergeDomClassNames(...values: Array<unknown>): string | undefined {
    const classes = values
        .flatMap((value) => typeof value === 'string' ? value.split(/\s+/) : [])
        .map((value) => value.trim())
        .filter(Boolean);

    if (classes.length === 0) return undefined;
    return Array.from(new Set(classes)).join(' ');
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
