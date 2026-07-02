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

    it('resolves local sources with query params against the image file path', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: './assets/demo.png?cache=1#preview',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual(['/notesRoot/daily/assets/demo.png']);
    });

    it('decodes URL-encoded local filesystem paths before resolving', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: './assets/Pasted%20image%2020251117105052.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual(['/notesRoot/daily/assets/Pasted image 20251117105052.png']);
    });

    it('resolves internal img asset refs through the same contained local path rules', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'img:assets/demo.png?cache=1#preview',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([
            '/notesRoot/daily/assets/demo.png',
            '/notesRoot/assets/demo.png',
        ]);
    });

    it('detects virtual image sources', () => {
        expect(isVirtualImageSource('https://example.com/demo.png')).toBe(true);
        expect(isVirtualImageSource('HTTPS://example.com/demo.png')).toBe(true);
        expect(isVirtualImageSource('DATA:IMAGE/PNG;BASE64,abc')).toBe(true);
        expect(isVirtualImageSource('blob:http://localhost/demo')).toBe(true);
        expect(isVirtualImageSource('BLOB:http://localhost/demo')).toBe(true);
        expect(isVirtualImageSource('asset://localhost/demo.png')).toBe(false);
        expect(isVirtualImageSource('./assets/demo.png')).toBe(false);
    });

    it('resolves note-relative sources against the current note directory', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: 'assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toBe('/notesRoot/daily/assets/demo.png');
    });

    it('keeps a opened-folder fallback for bare sources in nested notes', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([
            '/notesRoot/daily/assets/demo.png',
            '/notesRoot/assets/demo.png',
        ]);
    });

    it('does not add a notesRoot fallback for explicit relative segments', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: './assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual(['/notesRoot/daily/assets/demo.png']);
    });

    it('treats Windows-style explicit relative image paths as note-relative only', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '.\\assets\\demo.png?cache=1#preview',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual(['/notesRoot/daily/assets/demo.png']);
    });

    it('resolves explicit relative segments against the current note directory', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: '../assets/demo.png#preview',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toBe('/notesRoot/assets/demo.png');
    });

    it('resolves Windows-style parent image paths against the current note directory', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '..\\assets\\demo.png#preview',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual(['/notesRoot/assets/demo.png']);
    });

    it('rejects relative segments that escape the opened folder path', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '../../secret.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);
    });

    it('rejects internal notesRoot image path segments while allowing user dot folders', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '.vlaina/assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: '%2evlaina/assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'docs/.git/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'docs/%2egit/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'docs/%252egit/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'docs%2f.git%2fdemo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'docs/.GIT/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: './.git/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: './docs/%2egit/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: '.notes/assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([
            '/notesRoot/daily/.notes/assets/demo.png',
            '/notesRoot/.notes/assets/demo.png',
        ]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: '%2enotes/assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/2026-03-31.md',
        }, deps)).resolves.toEqual([
            '/notesRoot/daily/.notes/assets/demo.png',
            '/notesRoot/.notes/assets/demo.png',
        ]);
    });

    it('does not resolve images from internal current note paths', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: '.vlaina/workspace.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'docs/.git/config.md',
        }, deps)).resolves.toEqual([]);
    });

    it('does not resolve images from unsafe current note paths', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'daily/unsafe\u202Egnp.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: '/tmp/shared/unsafe\0.md',
        }, deps)).resolves.toEqual([]);
    });

    it('rejects relative segments that escape an external note directory', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '../secret.png',
            notesPath: '',
            currentNotePath: '/tmp/shared/note.md',
        }, deps)).resolves.toEqual([]);
    });

    it('resolves explicit relative images beside an absolute external note even when a folder is open', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: './assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: '/tmp/shared/note.md',
        }, deps)).resolves.toEqual(['/tmp/shared/assets/demo.png']);
    });

    it('does not force absolute external note images to stay inside the open folder', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: '/tmp/shared/note.md',
        }, deps)).resolves.toEqual([
            '/tmp/shared/assets/demo.png',
            '/notesRoot/assets/demo.png',
        ]);
    });

    it('rejects relative segments that escape an absolute external note directory when a folder is open', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '../secret.png',
            notesPath: '/notesRoot',
            currentNotePath: '/tmp/shared/note.md',
        }, deps)).resolves.toEqual([]);
    });

    it('keeps opened-folder containment for absolute note paths that are still inside the notesRoot', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: '../assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: '/notesRoot/daily/note.md',
        }, deps)).resolves.toEqual(['/notesRoot/assets/demo.png']);
    });

    it('falls back to the opened folder path when no current note path is available', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: 'assets/demo.png',
            notesPath: '/notesRoot',
        }, deps)).resolves.toBe('/notesRoot/assets/demo.png');
    });

    it('keeps virtual sources untouched and rejects absolute file paths from note content', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: 'https://example.com/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toBe('https://example.com/demo.png');

        await expect(resolveImageSourcePath({
            rawSrc: 'DATA:IMAGE/PNG;BASE64,abc',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toBe('data:image/png;base64,abc');

        await expect(resolveImageSourcePath({
            rawSrc: '/notesRoot/assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toBeNull();

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'C:\\Users\\me\\secret.png',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'img:/notesRoot/assets/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toEqual([]);
    });

    it('rejects unsafe media sources when path resolution is called directly', async () => {
        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'javascript:demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'http://127.0.0.1:3000/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'data:image/svg+xml;base64,PHN2Zz4=',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/\u202Ecod.exe.png',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toEqual([]);

        await expect(resolveImageSourcePathCandidates({
            rawSrc: 'assets/%E2%80%AEcod.exe.png',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toEqual([]);
    });

    it('normalizes protocol-relative public image URLs', async () => {
        await expect(resolveImageSourcePath({
            rawSrc: '//example.com/demo.png',
            notesPath: '/notesRoot',
            currentNotePath: 'note.md',
        }, deps)).resolves.toBe('https://example.com/demo.png');
    });
});
