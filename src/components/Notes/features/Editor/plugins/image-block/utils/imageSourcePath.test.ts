import { describe, expect, it } from 'vitest';
import {
    getImageSourceBase,
    isVirtualImageSource,
    resolveImageSourcePath,
    resolveImageSourcePathCandidates,
} from './imageSourcePath';

const deps = {
    getParentPath(path: string) {
        const normalized = path.replace(/\\/g, '/');
        const index = normalized.lastIndexOf('/');
        if (index <= 0) return null;
        return normalized.slice(0, index);
    },
    isAbsolutePath(path: string) {
        return path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path);
    },
    async joinPath(...segments: string[]) {
        return segments
            .filter(Boolean)
            .map((segment, index) => {
                if (index > 0) return segment.replace(/^[/\\]+/, '');
                return segment.replace(/[/\\]+$/, '');
            })
            .join('/');
    },
};

describe('imageSourcePath', () => {
    it('extracts the base source from image attrs', () => {
        expect(getImageSourceBase('./assets/demo.png#preview')).toBe('./assets/demo.png');
    });

    it('detects virtual image sources', () => {
        expect(isVirtualImageSource('https://example.com/demo.png')).toBe(true);
        expect(isVirtualImageSource('blob:http://localhost/demo')).toBe(true);
        expect(isVirtualImageSource('asset://localhost/demo.png')).toBe(false);
        expect(isVirtualImageSource('./assets/demo.png')).toBe(false);
    });

    it('resolves note-relative sources against the current note directory', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: 'assets/demo.png',
            notesPath: '/vault',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toBe('/vault/daily/assets/demo.png');
    });

    it('keeps a vault-root fallback for bare sources in nested notes', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/demo.png',
            notesPath: '/vault',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([
            '/vault/daily/assets/demo.png',
            '/vault/assets/demo.png',
        ]);
    });

    it('does not add a vault fallback for explicit relative segments', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: './assets/demo.png',
            notesPath: '/vault',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual(['/vault/daily/assets/demo.png']);
    });

    it('resolves explicit relative segments against the current note directory', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: '../assets/demo.png#preview',
            notesPath: '/vault',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toBe('/vault/assets/demo.png');
    });

    it('rejects relative segments that escape the vault path', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '../../secret.png',
            notesPath: '/vault',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);
    });

    it('rejects relative segments that escape an external note directory', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '../secret.png',
            notesPath: '',
            currentNotePath: '/tmp/shared/note.md',
        }, deps)).resolves.toEqual([]);
    });

    it('resolves explicit relative images beside an absolute external note even when a vault is open', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: './assets/demo.png',
            notesPath: '/vault',
            currentNotePath: '/tmp/shared/note.md',
        }, deps)).resolves.toEqual(['/tmp/shared/assets/demo.png']);
    });

    it('does not force absolute external note images to stay inside the open vault', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/demo.png',
            notesPath: '/vault',
            currentNotePath: '/tmp/shared/note.md',
        }, deps)).resolves.toEqual([
            '/tmp/shared/assets/demo.png',
            '/vault/assets/demo.png',
        ]);
    });

    it('rejects relative segments that escape an absolute external note directory when a vault is open', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '../secret.png',
            notesPath: '/vault',
            currentNotePath: '/tmp/shared/note.md',
        }, deps)).resolves.toEqual([]);
    });

    it('keeps vault containment for absolute note paths that are still inside the vault', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '../assets/demo.png',
            notesPath: '/vault',
            currentNotePath: '/vault/daily/note.md',
        }, deps)).resolves.toEqual(['/vault/assets/demo.png']);
    });

    it('falls back to the vault path when no current note path is available', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: 'assets/demo.png',
            notesPath: '/vault',
        }, deps)).resolves.toBe('/vault/assets/demo.png');
    });

    it('keeps virtual sources untouched and rejects absolute file paths from note content', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: 'https://example.com/demo.png',
            notesPath: '/vault',
            currentNotePath: 'note.md',
        }, deps)).resolves.toBe('https://example.com/demo.png');

        await expect(resolveImageSourcePath({
            rawSrc: '/vault/assets/demo.png',
            notesPath: '/vault',
            currentNotePath: 'note.md',
        }, deps)).resolves.toBeNull();

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'C:\\Users\\me\\secret.png',
            notesPath: '/vault',
            currentNotePath: 'note.md',
        }, deps)).resolves.toEqual([]);
    });
});
