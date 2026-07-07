import { getBase64DecodedByteLength } from '@/lib/markdown/dataImagePolicy';
import {
    DATA_URL_REGEX,
    MAX_ATTACHMENT_IMAGE_BYTES,
    SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME,
} from './attachmentStorageTypes';
import {
    assertAttachmentImageSize,
    normalizeSupportedAttachmentMimeType,
    prepareAttachmentImageBytes,
} from './attachmentStorageMime';

export function uint8ArrayToBase64(bytes: Uint8Array): string {
    const CHUNK_SIZE = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return window.btoa(binary);
}

export function encodeAttachmentDataUrl(bytes: Uint8Array, mimeType: string): string {
    return `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`;
}

export function prepareAttachmentOutputBytes(bytes: Uint8Array, mimeType: string): {
    bytes: Uint8Array;
    mimeType: string;
} {
    const outputMimeType = normalizeSupportedAttachmentMimeType(mimeType) ?? mimeType;
    const outputBytes = prepareAttachmentImageBytes(bytes, outputMimeType);
    assertAttachmentImageSize(outputBytes.byteLength);
    return {
        bytes: outputBytes,
        mimeType: outputMimeType,
    };
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
    const match = DATA_URL_REGEX.exec(dataUrl.trim());
    if (!match) {
        return null;
    }

    const mimeType = match[1] || 'application/octet-stream';
    const isBase64 = Boolean(match[2]);
    const payload = match[3] || '';

    if (!isBase64) {
        try {
            return {
                bytes: new TextEncoder().encode(decodeURIComponent(payload)),
                mimeType,
            };
        } catch {
            return null;
        }
    }

    let binary = '';
    try {
        binary = window.atob(payload);
    } catch {
        return null;
    }

    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return { bytes, mimeType };
}

export function isAttachmentDataUrlWithinSizeLimit(dataUrl: string): boolean {
    const match = DATA_URL_REGEX.exec(dataUrl.trim());
    if (!match) {
        return false;
    }

    const mimeType = match[1]?.trim().toLowerCase() ?? '';
    if (!Object.prototype.hasOwnProperty.call(SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME, mimeType)) {
        return false;
    }

    const payload = match[3] || '';
    if (!match[2]) {
        if (payload.length > MAX_ATTACHMENT_IMAGE_BYTES * 3) {
            return false;
        }
        try {
            return new TextEncoder().encode(decodeURIComponent(payload)).byteLength <= MAX_ATTACHMENT_IMAGE_BYTES;
        } catch {
            return false;
        }
    }

    const byteLength = getBase64DecodedByteLength(payload);
    return byteLength !== null && byteLength <= MAX_ATTACHMENT_IMAGE_BYTES;
}

export function sanitizeInlineAttachmentDataUrl(dataUrl: string): string | null {
    if (!isAttachmentDataUrlWithinSizeLimit(dataUrl)) {
        return null;
    }

    const decoded = dataUrlToBytes(dataUrl);
    const mimeType = decoded ? normalizeSupportedAttachmentMimeType(decoded.mimeType) : null;
    if (!decoded || !mimeType) {
        return null;
    }

    if (mimeType !== 'image/svg+xml') {
        return dataUrl;
    }

    const prepared = prepareAttachmentOutputBytes(decoded.bytes, mimeType);
    return encodeAttachmentDataUrl(prepared.bytes, prepared.mimeType);
}

export function inferDataUrlExtension(mimeType: string): string {
    const normalized = mimeType.toLowerCase();
    if (normalized === 'image/jpeg') return 'jpg';
    if (normalized === 'image/svg+xml') return 'svg';
    const subtype = normalized.split('/')[1]?.replace(/[^a-z0-9]+/g, '');
    return subtype || 'bin';
}
