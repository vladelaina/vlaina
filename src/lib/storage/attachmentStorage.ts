import { getElectronBridge } from '@/lib/electron/bridge';
import { getStorageAdapter, joinPath } from './adapter';
import { extractStoredAttachmentFilename } from './attachmentUrl';
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

const DATA_URL_REGEX = /^data:([^;,]+)(;base64)?,(.*)$/i;

interface SaveAttachmentOptions {
    persist?: boolean;
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

export async function saveAttachment(file: File, options: SaveAttachmentOptions = {}): Promise<Attachment> {
    const base64 = await fileToBase64(file);
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

            const ext = file.name.split('.').pop() || 'bin';
            const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
            absolutePath = await joinPath(dirPath, filename);

            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            await storage.writeBinaryFile(absolutePath, data, { recursive: true });

            assetUrl = await buildAttachmentAssetUrl(absolutePath, base64);
        } catch (e) {
        }
    }

    return {
        id: crypto.randomUUID(),
        path: absolutePath,
        previewUrl: base64,
        assetUrl,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
    };
}

export async function deleteAttachment(attachment: Attachment): Promise<void> {
    const storage = getStorageAdapter();
    const attachmentPath = attachment.path?.trim();
    if (attachmentPath) {
        await storage.deleteFile(attachmentPath).catch(() => {});
        return;
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
        return {
            bytes: new TextEncoder().encode(decodeURIComponent(payload)),
            mimeType,
        };
    }

    const binary = window.atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return { bytes, mimeType };
}

export async function persistDataUrlAttachment(dataUrl: string): Promise<string | null> {
    const decoded = dataUrlToBytes(dataUrl);
    if (!decoded) {
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

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
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

export async function convertToBase64(attachment: Attachment): Promise<string> {
    if (attachment.previewUrl.startsWith('data:')) {
        return attachment.previewUrl;
    }

    const storage = getStorageAdapter();

    if (attachment.path) {
        try {
            const data = await storage.readBinaryFile(attachment.path);
            const base64 = uint8ArrayToBase64(data);
            return `data:${attachment.type};base64,${base64}`;
        } catch (e) {
        }
    }

    const storedFilename =
        extractStoredAttachmentFilename(attachment.previewUrl) ||
        extractStoredAttachmentFilename(attachment.assetUrl);
    if (storedFilename) {
        const basePath = await storage.getBasePath();
        const data = await storage.readBinaryFile(await getPrimaryAttachmentPath(basePath, storedFilename));
        const base64 = uint8ArrayToBase64(data);
        return `data:${attachment.type};base64,${base64}`;
    }

    throw new Error('Cannot convert attachment to Base64');
}
