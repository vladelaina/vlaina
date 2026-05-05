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
        expect(getImageSourceBase('./assets/demo.png#a=left&w=30%25')).toBe('./assets/demo.png');
    });

    it('detects virtual image sources', () => {
        expect(isVirtualImageSource('https://example.com/demo.png')).toBe(true);
        expect(isVirtualImageSource('blob:http://localhost/demo')).toBe(true);
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
        }, deps)).resolves.toEqual(['/vault/daily/./assets/demo.png']);
    });

    it('resolves explicit relative segments against the current note directory', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: '../assets/demo.png#c=1,2,3,4,1',
            notesPath: '/vault',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toBe('/vault/daily/../assets/demo.png');
    });

    it('falls back to the vault path when no current note path is available', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: 'assets/demo.png',
            notesPath: '/vault',
        }, deps)).resolves.toBe('/vault/assets/demo.png');
    });

    it('keeps virtual and absolute sources untouched', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: 'https://example.com/demo.png',
            notesPath: '/vault',
            currentNotePath: 'note.md',
        }, deps)).resolves.toBe('https://example.com/demo.png');

        await expect(resolveImageSourcePath({
            rawSrc: '/vault/assets/demo.png',
            notesPath: '/vault',
            currentNotePath: 'note.md',
        }, deps)).resolves.toBe('/vault/assets/demo.png');
    });
});
