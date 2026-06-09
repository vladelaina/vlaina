import { describe, expect, it, vi } from 'vitest';
import { readUploadPreviewDataUrl } from './uploadPreviewDataUrl';

describe('uploadPreviewDataUrl', () => {
    it('rejects oversized icon preview files before reading bytes', async () => {
        const file = {
            name: 'large.png',
            type: 'image/png',
            size: 11 * 1024 * 1024,
            arrayBuffer: vi.fn(),
        } as unknown as File;

        await expect(readUploadPreviewDataUrl(file)).resolves.toBeNull();

        expect(file.arrayBuffer).not.toHaveBeenCalled();
    });

    it('sanitizes SVG previews before returning a data URL', async () => {
        const svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
            '<script>alert(1)</script>',
            '<circle cx="1" cy="1" r="1"></circle>',
            '</svg>',
        ].join('');
        const file = {
            name: 'icon.svg',
            type: 'image/svg+xml',
            size: svg.length,
            arrayBuffer: vi.fn(async () => new TextEncoder().encode(svg).buffer),
        } as unknown as File;

        const result = await readUploadPreviewDataUrl(file);
        const decoded = decodeURIComponent((result ?? '').slice((result ?? '').indexOf(',') + 1));

        expect(result?.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
        expect(decoded).toContain('<circle');
        expect(decoded).not.toContain('<script');
        expect(decoded).not.toContain('onload');
    });

    it('rejects when non-SVG preview reads are aborted', async () => {
        const OriginalFileReader = globalThis.FileReader;
        class MockFileReader {
            result: string | ArrayBuffer | null = null;
            onabort: (() => void) | null = null;
            private listeners = new Map<string, Array<() => void>>();

            addEventListener(type: string, listener: () => void) {
                this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
            }

            readAsDataURL() {
                setTimeout(() => {
                    this.onabort?.();
                    for (const listener of this.listeners.get('abort') ?? []) {
                        listener();
                    }
                }, 0);
            }
        }

        vi.stubGlobal('FileReader', MockFileReader);
        try {
            const file = {
                name: 'icon.png',
                type: 'image/png',
                size: 3,
            } as unknown as File;

            await expect(readUploadPreviewDataUrl(file)).rejects.toThrow('Icon preview file read was aborted');
        } finally {
            vi.stubGlobal('FileReader', OriginalFileReader);
        }
    });
});
