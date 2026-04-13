import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getStorageAdapter } from './adapter';

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

export async function saveAttachment(file: File): Promise<Attachment> {
    const base64 = await fileToBase64(file);
    let absolutePath = '';
    let assetUrl = '';

    const storage = getStorageAdapter();

    if (storage.platform === 'tauri') {
        try {
            const appDataPath = await appDataDir();
            const dirPath = await join(appDataPath, ATTACHMENT_DIR);

            if (!(await storage.exists(dirPath))) {
                await storage.mkdir(dirPath, true);
            }

            const ext = file.name.split('.').pop() || 'bin';
            const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
            absolutePath = await join(dirPath, filename);

            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            await storage.writeBinaryFile(absolutePath, data);

            assetUrl = convertFileSrc(absolutePath);
        } catch (e) {
            console.error('[Attachment] Disk save failed:', e);
        }
    } else {
        assetUrl = base64;
    }

    return {
        id: crypto.randomUUID(),
        path: absolutePath,
        previewUrl: base64,
        assetUrl: assetUrl || base64,
        name: file.name,
        type: file.type,
        size: file.size
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

export async function convertToBase64(attachment: Attachment): Promise<string> {
    if (attachment.previewUrl.startsWith('data:')) {
        return attachment.previewUrl;
    }

    const storage = getStorageAdapter();

    if (storage.platform === 'tauri' && attachment.path) {
        try {
            const filename = attachment.path.split(/[\\/]/).pop();
            if (filename) {
                const appDataPath = await appDataDir();
                const fullPath = await join(appDataPath, ATTACHMENT_DIR, filename);
                const data = await storage.readBinaryFile(fullPath);
                const base64 = uint8ArrayToBase64(data);
                return `data:${attachment.type};base64,${base64}`;
            }
        } catch (e) {
            console.error('[Attachment] Fallback disk read failed:', e);
        }
    }

    throw new Error('Cannot convert attachment to Base64');
}
