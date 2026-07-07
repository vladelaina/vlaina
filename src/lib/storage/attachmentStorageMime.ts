import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';
import {
    MAX_ATTACHMENT_IMAGE_BYTES,
    MAX_ATTACHMENT_TEXT_BYTES,
    MAX_ATTACHMENT_TEXT_CHARS,
    SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME,
    SUPPORTED_ATTACHMENT_MIME_BY_EXTENSION,
    SUPPORTED_ATTACHMENT_TEXT_EXTENSIONS,
    SUPPORTED_ATTACHMENT_TEXT_MIME_BY_EXTENSION,
    SUPPORTED_ATTACHMENT_TEXT_MIME_TYPES,
    type AttachmentFileKind,
    type NormalizedAttachmentFileType,
} from './attachmentStorageTypes';

export function getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.trim().toLowerCase() ?? '';
}

function normalizeAttachmentImageMimeType(file: File): string | null {
    const rawMimeType = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
    const mimeType = rawMimeType === 'image/jpg' ? 'image/jpeg' : rawMimeType;
    if (mimeType) {
        return Object.prototype.hasOwnProperty.call(SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME, mimeType)
            ? mimeType
            : null;
    }

    return SUPPORTED_ATTACHMENT_MIME_BY_EXTENSION[getFileExtension(file.name)] ?? null;
}

function normalizeAttachmentTextMimeType(file: File): string | null {
    const rawMimeType = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
    if (rawMimeType) {
        if (rawMimeType.startsWith('text/') || SUPPORTED_ATTACHMENT_TEXT_MIME_TYPES.has(rawMimeType)) {
            return rawMimeType;
        }
        return null;
    }

    const extension = getFileExtension(file.name);
    if (!SUPPORTED_ATTACHMENT_TEXT_EXTENSIONS.has(extension)) {
        return null;
    }
    return SUPPORTED_ATTACHMENT_TEXT_MIME_BY_EXTENSION[extension] ?? 'text/plain';
}

export function normalizeAttachmentFileType(file: File): NormalizedAttachmentFileType | null {
    const imageMimeType = normalizeAttachmentImageMimeType(file);
    if (imageMimeType) {
        return { kind: 'image', mimeType: imageMimeType };
    }

    const textMimeType = normalizeAttachmentTextMimeType(file);
    if (textMimeType) {
        return { kind: 'text', mimeType: textMimeType };
    }

    return null;
}

function getAttachmentExtensionFromMimeType(mimeType: string, kind: AttachmentFileKind): string {
    if (mimeType === 'image/jpeg') {
        return 'jpg';
    }
    if (kind === 'text') {
        if (mimeType === 'application/json') return 'json';
        if (mimeType === 'application/toml') return 'toml';
        if (mimeType === 'application/xml') return 'xml';
        if (mimeType === 'application/yaml' || mimeType === 'application/x-yaml') return 'yaml';
        if (mimeType === 'text/csv') return 'csv';
        if (mimeType === 'text/html') return 'html';
        if (mimeType === 'text/markdown') return 'md';
        return 'txt';
    }
    return SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME[mimeType]?.[0] ?? 'bin';
}

export function getAttachmentFilename(fileName: string, mimeType: string, kind: AttachmentFileKind): string {
    const extension = getAttachmentExtensionFromMimeType(mimeType, kind);
    const currentExtension = getFileExtension(fileName);
    const allowedExtensions = kind === 'image'
        ? SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME[mimeType] ?? []
        : Array.from(SUPPORTED_ATTACHMENT_TEXT_EXTENSIONS);
    if (allowedExtensions.includes(currentExtension)) {
        return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${currentExtension}`;
    }
    return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
}

export function prepareAttachmentImageBytes(bytes: Uint8Array, mimeType: string): Uint8Array {
    return mimeType === 'image/svg+xml' ? sanitizeSvgBytes(bytes) : bytes;
}

export function normalizeSupportedAttachmentMimeType(value: string): string | null {
    const rawMimeType = value.split(';')[0]?.trim().toLowerCase() ?? '';
    const mimeType = rawMimeType === 'image/jpg' ? 'image/jpeg' : rawMimeType;
    return Object.prototype.hasOwnProperty.call(SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME, mimeType)
        ? mimeType
        : null;
}

export function assertAttachmentImageSize(byteLength: number | null | undefined): void {
    if (
        typeof byteLength !== 'number' ||
        !Number.isFinite(byteLength) ||
        byteLength < 0 ||
        byteLength > MAX_ATTACHMENT_IMAGE_BYTES
    ) {
        throw new Error('Attachment image is too large.');
    }
}

export function assertAttachmentTextSize(byteLength: number | null | undefined): void {
    if (
        typeof byteLength !== 'number' ||
        !Number.isFinite(byteLength) ||
        byteLength < 0 ||
        byteLength > MAX_ATTACHMENT_TEXT_BYTES
    ) {
        throw new Error('Attachment file is too large.');
    }
}

export function decodeAttachmentTextBytes(bytes: Uint8Array): string {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (text.includes('\u0000')) {
        throw new Error('Unsupported attachment type');
    }

    const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
    if (replacementCount > 0 && replacementCount / Math.max(text.length, 1) > 0.01) {
        throw new Error('Unsupported attachment type');
    }

    return text.slice(0, MAX_ATTACHMENT_TEXT_CHARS);
}

export function assertReadableAttachmentInfo(
    info: { isDirectory?: boolean; isFile?: boolean; size?: number } | null | undefined,
): void {
    if (
        info?.isFile === false ||
        info?.isDirectory === true ||
        (typeof info?.size === 'number' && (
            !Number.isFinite(info.size) ||
            info.size < 0 ||
            info.size > MAX_ATTACHMENT_IMAGE_BYTES
        ))
    ) {
        throw new Error('Attachment image is too large.');
    }
}
