import type { Alignment } from '../types';
import { buildImageSource, parseImageSource } from './imageSourceFragment';

type NodeAttrs = Record<string, unknown>;

function getSrc(attrs: NodeAttrs): string {
    return typeof attrs.src === 'string' ? attrs.src : '';
}

function normalizeAlignment(value: unknown): Alignment | null {
    if (value === 'left' || value === 'center' || value === 'right') {
        return value;
    }
    return null;
}

function normalizeWidth(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'auto') return null;
    return trimmed;
}

function dedupeTokens(tokens: string[]): string[] {
    return Array.from(new Set(tokens.filter(Boolean)));
}

export function getImageAlignment(attrs: NodeAttrs): Alignment {
    const parsed = parseImageSource(getSrc(attrs));
    return parsed.align ?? normalizeAlignment(attrs.align) ?? 'center';
}

export function getImageWidth(attrs: NodeAttrs): string | null {
    const parsed = parseImageSource(getSrc(attrs));
    return parsed.width ?? normalizeWidth(attrs.width);
}

export function mergeImageNodeAttrs(latestAttrs: NodeAttrs, incomingAttrs: NodeAttrs): NodeAttrs {
    const latestParsed = parseImageSource(getSrc(latestAttrs));

    const incomingSrc = typeof incomingAttrs.src === 'string' ? incomingAttrs.src : undefined;
    const incomingParsed = incomingSrc ? parseImageSource(incomingSrc) : null;

    const incomingAlign = normalizeAlignment(incomingAttrs.align);
    const incomingWidth = normalizeWidth(incomingAttrs.width);

    const mergedAlign =
        incomingAlign ??
        incomingParsed?.align ??
        latestParsed.align ??
        normalizeAlignment(latestAttrs.align) ??
        null;
    const mergedWidth =
        incomingWidth ??
        incomingParsed?.width ??
        latestParsed.width ??
        normalizeWidth(latestAttrs.width);
    const mergedCrop = incomingParsed?.crop ?? latestParsed.crop ?? null;
    const mergedBaseSrc = incomingParsed?.baseSrc || latestParsed.baseSrc || '';
    const mergedExtras = incomingParsed?.extras
        ? dedupeTokens([...latestParsed.extras, ...incomingParsed.extras])
        : latestParsed.extras;

    const nextAttrs: NodeAttrs = { ...latestAttrs, ...incomingAttrs };
    delete nextAttrs.align;
    delete nextAttrs.width;
    nextAttrs.src = buildImageSource(mergedBaseSrc, {
        crop: mergedCrop,
        align: mergedAlign,
        width: mergedWidth,
        extras: mergedExtras,
    });

    return nextAttrs;
}
