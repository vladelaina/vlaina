import type { Alignment } from '../types';

export interface CropParams {
    x: number;
    y: number;
    width: number;
    height: number;
    ratio: number;
}

export interface ParsedImageSource {
    baseSrc: string;
    crop: CropParams | null;
    align: Alignment | null;
    width: string | null;
    extras: string[];
}

function normalizeAlign(value: string | null | undefined): Alignment | null {
    if (!value) return null;
    if (value === 'left' || value === 'center' || value === 'right') return value;
    return null;
}

function normalizeWidth(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'auto') return null;
    return trimmed;
}

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function parseCropToken(token: string): CropParams | null {
    if (!token.startsWith('c=')) return null;
    const parts = token.substring(2).split(',').map(Number);
    if (parts.length < 4 || parts.some(v => Number.isNaN(v))) return null;
    return {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3],
        ratio: parts.length >= 5 ? parts[4] : 1,
    };
}

export function parseImageSource(src: string): ParsedImageSource {
    if (!src) {
        return { baseSrc: '', crop: null, align: null, width: null, extras: [] };
    }

    const hashIndex = src.indexOf('#');
    if (hashIndex === -1) {
        return { baseSrc: src, crop: null, align: null, width: null, extras: [] };
    }

    const baseSrc = src.slice(0, hashIndex);
    const fragment = src.slice(hashIndex + 1);
    if (!fragment) {
        return { baseSrc, crop: null, align: null, width: null, extras: [] };
    }

    const tokens = fragment.split('&').filter(Boolean);
    let crop: CropParams | null = null;
    let align: Alignment | null = null;
    let width: string | null = null;
    const extras: string[] = [];

    for (const token of tokens) {
        if (!crop) {
            const parsedCrop = parseCropToken(token);
            if (parsedCrop) {
                crop = parsedCrop;
                continue;
            }
        }

        if (token.startsWith('a=')) {
            align = normalizeAlign(safeDecode(token.substring(2)));
            continue;
        }

        if (token.startsWith('w=')) {
            width = normalizeWidth(safeDecode(token.substring(2)));
            continue;
        }

        extras.push(token);
    }

    return { baseSrc, crop, align, width, extras };
}

export function buildImageSource(
    baseSrc: string,
    options: { crop?: CropParams | null; align?: Alignment | null; width?: string | null; extras?: string[] }
): string {
    const parts: string[] = [];
    const crop = options.crop ?? null;
    const align = options.align ?? null;
    const width = normalizeWidth(options.width ?? null);
    const extras = (options.extras ?? []).filter(Boolean);

    if (crop) {
        parts.push(
            `c=${crop.x.toFixed(6)},${crop.y.toFixed(6)},${crop.width.toFixed(6)},${crop.height.toFixed(6)},${crop.ratio.toFixed(6)}`
        );
    }

    if (align && align !== 'center') {
        parts.push(`a=${encodeURIComponent(align)}`);
    }

    if (width) {
        parts.push(`w=${encodeURIComponent(width)}`);
    }

    if (extras.length > 0) {
        parts.push(...extras);
    }

    if (parts.length === 0) return baseSrc;
    return `${baseSrc}#${parts.join('&')}`;
}

export function parseCropFragment(src: string): { baseSrc: string; params: CropParams | null } {
    const parsed = parseImageSource(src);
    return { baseSrc: parsed.baseSrc, params: parsed.crop };
}

export function generateCropFragment(
    percentageCrop: { x: number; y: number; width: number; height: number },
    ratio: number
): string {
    const { x, y, width, height } = percentageCrop;
    return `c=${x.toFixed(6)},${y.toFixed(6)},${width.toFixed(6)},${height.toFixed(6)},${ratio.toFixed(6)}`;
}
