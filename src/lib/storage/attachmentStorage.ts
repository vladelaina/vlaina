import { getElectronBridge } from '@/lib/electron/bridge';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { getBase64DecodedByteLength, MAX_INLINE_IMAGE_BYTES } from '@/lib/markdown/dataImagePolicy';
import { normalizeRenderableDataImageSrc } from '@/lib/markdown/renderableImagePolicy';
import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';
import { getStorageAdapter, joinPath } from './adapter';
import {
    extractStoredAttachmentFilename,
    inferAttachmentMimeTypeFromFilename,
    sanitizeAttachmentFilename,
} from './attachmentUrl';
import {
    getPrimaryAttachmentDir,
    getPrimaryAttachmentPath,
} from './attachmentPaths';

export interface Attachment {
    id: string;
    path: string;
    previewUrl: string;
    assetUrl: string;
    name: string;
    type: string;
    size: number;
}

export function createStoredAttachmentFromSource(src: string, id = 'stored-attachment'): Attachment | null {
    const filename = extractStoredAttachmentFilename(src);
    if (!filename) {
        return null;
    }

    const trimmed = src.trim();
    return {
        id,
        path: '',
        previewUrl: trimmed,
        assetUrl: trimmed,
        name: filename,
        type: inferAttachmentMimeTypeFromFilename(filename),
        size: 0,
    };
}

const DATA_URL_REGEX = /^data:([^;,]+)(;base64)?,(.*)$/i;
export const MAX_ATTACHMENT_IMAGE_BYTES = MAX_INLINE_IMAGE_BYTES;
const SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME: Record<string, readonly string[]> = {
    'image/avif': ['avif'],
    'image/bmp': ['bmp'],
    'image/gif': ['gif'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/svg+xml': ['svg'],
    'image/webp': ['webp'],
};
const SUPPORTED_ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
    Object.entries(SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME).flatMap(([mimeType, extensions]) =>
        extensions.map((extension) => [extension, mimeType])
    )
);

interface SaveAttachmentOptions {
    persist?: boolean;
}

interface ConvertAttachmentOptions {
    allowPath?: (path: string) => boolean | Promise<boolean>;
}

function getPathApi() {
    const bridge = getElectronBridge();
    return bridge?.path ?? null;
}

async function buildAttachmentAssetUrl(absolutePath: string, previewUrl: string): Promise<string> {
    const pathApi = getPathApi();
    if (!pathApi || !absolutePath) {
        return previewUrl;
    }

    return await pathApi.toFileUrl(absolutePath);
}

function getFileExtension(fileName: string): string {
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

function getAttachmentExtensionFromMimeType(mimeType: string): string {
    if (mimeType === 'image/jpeg') {
        return 'jpg';
    }
    return SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME[mimeType]?.[0] ?? 'bin';
}

function getAttachmentFilename(fileName: string, mimeType: string): string {
    const extension = getAttachmentExtensionFromMimeType(mimeType);
    const currentExtension = getFileExtension(fileName);
    const allowedExtensions = SUPPORTED_ATTACHMENT_IMAGE_EXTENSIONS_BY_MIME[mimeType] ?? [];
    if (allowedExtensions.includes(currentExtension)) {
        return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${currentExtension}`;
    }
    return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
}

function prepareAttachmentImageBytes(bytes: Uint8Array, mimeType: string): Uint8Array {
    return mimeType === 'image/svg+xml' ? sanitizeSvgBytes(bytes) : bytes;
}

function assertAttachmentImageSize(byteLength: number | null | undefined): void {
    if (
        typeof byteLength !== 'number' ||
        !Number.isFinite(byteLength) ||
        byteLength < 0 ||
        byteLength > MAX_ATTACHMENT_IMAGE_BYTES
    ) {
        throw new Error('Attachment image is too large.');
    }
}

function assertReadableAttachmentInfo(
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

function isSameNormalizedPath(leftPath: string, rightPath: string): boolean {
    return (
        normalizeContainedAssetPath(leftPath, rightPath) !== null &&
        normalizeContainedAssetPath(rightPath, leftPath) !== null
    );
}

async function resolvePrimaryAttachmentFilePath(path: string): Promise<string | null> {
    const attachmentPath = path.trim();
    const filename = sanitizeAttachmentFilename(attachmentPath.split(/[\\/]/).pop() ?? '');
    if (!filename) {
        return null;
    }

    const storage = getStorageAdapter();
    const basePath = await storage.getBasePath();
    const attachmentDir = await getPrimaryAttachmentDir(basePath);
    const containedPath = normalizeContainedAssetPath(attachmentPath, attachmentDir);
    if (!containedPath) {
        return null;
    }

    const expectedPath = normalizeContainedAssetPath(
        await getPrimaryAttachmentPath(basePath, filename),
        attachmentDir,
    );
    if (!expectedPath || !isSameNormalizedPath(containedPath, expectedPath)) {
        return null;
    }

    return containedPath;
}

async function readFileBytes(file: File): Promise<Uint8Array> {
    if (typeof file.arrayBuffer === 'function') {
        return new Uint8Array(await file.arrayBuffer());
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (result instanceof ArrayBuffer) {
                resolve(new Uint8Array(result));
                return;
            }
            reject(new Error('Failed to read attachment bytes'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment bytes'));
        reader.onabort = () => reject(new Error('Attachment file read was aborted'));
        reader.readAsArrayBuffer(file);
    });
}

export async function saveAttachment(file: File, options: SaveAttachmentOptions = {}): Promise<Attachment> {
    const mimeType = normalizeAttachmentImageMimeType(file);
    if (!mimeType) {
        throw new Error('Unsupported attachment type');
    }
    assertAttachmentImageSize(file.size);

    const bytes = prepareAttachmentImageBytes(await readFileBytes(file), mimeType);
    assertAttachmentImageSize(bytes.byteLength);
    const previewUrl = `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`;
    let absolutePath = '';
    let assetUrl = '';

    const storage = getStorageAdapter();

    if (options.persist !== false) {
        try {
            const appDataPath = await storage.getBasePath();
            const dirPath = await getPrimaryAttachmentDir(appDataPath);

            if (!(await storage.exists(dirPath))) {
                await storage.mkdir(dirPath, true);
            }

            const filename = getAttachmentFilename(file.name, mimeType);
            absolutePath = await joinPath(dirPath, filename);
            await storage.writeBinaryFile(absolutePath, bytes, { recursive: true });
            assetUrl = await buildAttachmentAssetUrl(absolutePath, previewUrl);
        } catch (e) {
        }
    }

    return {
        id: crypto.randomUUID(),
        path: absolutePath,
        previewUrl,
        assetUrl,
        name: file.name,
        type: mimeType,
        size: file.size,
    };
}

export async function deleteAttachment(attachment: Attachment): Promise<void> {
    const storage = getStorageAdapter();
    const attachmentPath = attachment.path?.trim();
    if (attachmentPath) {
        const managedPath = await resolvePrimaryAttachmentFilePath(attachmentPath);
        if (managedPath) {
            await storage.deleteFile(managedPath).catch(() => {});
            return;
        }
    }

    const storedFilename =
        extractStoredAttachmentFilename(attachment.previewUrl) ||
        extractStoredAttachmentFilename(attachment.assetUrl);
    if (!storedFilename) {
        return;
    }

    const basePath = await storage.getBasePath();
    await storage.deleteFile(await getPrimaryAttachmentPath(basePath, storedFilename)).catch(() => {});
}

function inferDataUrlExtension(mimeType: string): string {
    const normalized = mimeType.toLowerCase();
    if (normalized === 'image/jpeg') return 'jpg';
    if (normalized === 'image/svg+xml') return 'svg';
    const subtype = normalized.split('/')[1]?.replace(/[^a-z0-9]+/g, '');
    return subtype || 'bin';
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
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

export async function persistDataUrlAttachment(dataUrl: string): Promise<string | null> {
    const normalizedDataUrl = normalizeRenderableDataImageSrc(dataUrl);
    if (!normalizedDataUrl) {
        return null;
    }
    if (!isAttachmentDataUrlWithinSizeLimit(normalizedDataUrl)) {
        return null;
    }

    const decoded = dataUrlToBytes(normalizedDataUrl);
    if (!decoded) {
        return null;
    }
    if (decoded.bytes.byteLength > MAX_ATTACHMENT_IMAGE_BYTES) {
        return null;
    }

    const storage = getStorageAdapter();
    const appDataPath = await storage.getBasePath();
    const dirPath = await getPrimaryAttachmentDir(appDataPath);

    if (!(await storage.exists(dirPath))) {
        await storage.mkdir(dirPath, true);
    }

    const ext = inferDataUrlExtension(decoded.mimeType);
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const absolutePath = await joinPath(dirPath, filename);
    await storage.writeBinaryFile(absolutePath, decoded.bytes, { recursive: true });
    return `attachment://${encodeURIComponent(filename)}`;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    const CHUNK_SIZE = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return window.btoa(binary);
}

export async function convertToBase64(attachment: Attachment, options: ConvertAttachmentOptions = {}): Promise<string> {
    if (/^data:/i.test(attachment.previewUrl.trim())) {
        if (!isAttachmentDataUrlWithinSizeLimit(attachment.previewUrl)) {
            throw new Error('Attachment image is too large.');
        }
        return attachment.previewUrl;
    }

    const storage = getStorageAdapter();

    if (attachment.path) {
        try {
            const managedPath = await resolvePrimaryAttachmentFilePath(attachment.path);
            const readablePath = managedPath || ((await options.allowPath?.(attachment.path)) ? attachment.path : null);
            if (readablePath) {
                const info = await storage.stat(readablePath).catch(() => null);
                assertReadableAttachmentInfo(info);
                const data = await storage.readBinaryFile(readablePath, MAX_ATTACHMENT_IMAGE_BYTES);
                assertAttachmentImageSize(data.byteLength);
                const base64 = uint8ArrayToBase64(data);
                return `data:${attachment.type};base64,${base64}`;
            }
        } catch (e) {
        }
    }

    const storedFilename =
        extractStoredAttachmentFilename(attachment.previewUrl) ||
        extractStoredAttachmentFilename(attachment.assetUrl);
    if (storedFilename) {
        const basePath = await storage.getBasePath();
        const attachmentPath = await getPrimaryAttachmentPath(basePath, storedFilename);
        const info = await storage.stat(attachmentPath).catch(() => null);
        assertReadableAttachmentInfo(info);
        const data = await storage.readBinaryFile(attachmentPath, MAX_ATTACHMENT_IMAGE_BYTES);
        assertAttachmentImageSize(data.byteLength);
        const base64 = uint8ArrayToBase64(data);
        return `data:${attachment.type};base64,${base64}`;
    }

    throw new Error('Cannot convert attachment to Base64');
}
