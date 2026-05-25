import { getElectronBridge } from '@/lib/electron/bridge';
import { getStorageAdapter, joinPath } from './adapter';

export interface Attachment {
    id: string;
    path: string;
    previewUrl: string;
    assetUrl: string;
    name: string;
    type: string;
    size: number;
}

const ATTACHMENT_DIR = 'attachments';

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

export async function saveAttachment(file: File): Promise<Attachment> {
    const base64 = await fileToBase64(file);
    let absolutePath = '';
    let assetUrl = '';

    const storage = getStorageAdapter();

    try {
        const appDataPath = await storage.getBasePath();
        const dirPath = await joinPath(appDataPath, ATTACHMENT_DIR);

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

function sanitizeAttachmentFilename(value: string): string | null {
    const normalized = value.trim();
    if (!normalized || normalized === '.' || normalized === '..' || /[\\/]/.test(normalized)) {
        return null;
    }
    return normalized;
}

function decodeAttachmentFilename(value: string): string | null {
    try {
        return sanitizeAttachmentFilename(decodeURIComponent(value));
    } catch {
        return sanitizeAttachmentFilename(value);
    }
}

function extractStoredAttachmentFilename(src: string): string | null {
    const trimmed = src.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('attachment://')) {
        return decodeAttachmentFilename(trimmed.slice('attachment://'.length));
    }

    if (trimmed.startsWith('app-file://attachment/')) {
        return decodeAttachmentFilename(trimmed.slice('app-file://attachment/'.length));
    }

    try {
        const url = new URL(trimmed);
        const marker = '/attachments/';
        const markerIndex = url.pathname.lastIndexOf(marker);
        if (markerIndex === -1) return null;
        return decodeAttachmentFilename(url.pathname.slice(markerIndex + marker.length));
    } catch {
        return null;
    }
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
        const fullPath = await joinPath(basePath, ATTACHMENT_DIR, storedFilename);
        const data = await storage.readBinaryFile(fullPath);
        const base64 = uint8ArrayToBase64(data);
        return `data:${attachment.type};base64,${base64}`;
    }

    throw new Error('Cannot convert attachment to Base64');
}
