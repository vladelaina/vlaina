import { describe, expect, it, vi } from 'vitest';
import {
    getMarkdownHtmlImageAttrs,
    MAX_MARKDOWN_HTML_IMAGE_CHILD_SCAN_NODES,
} from './markdownHtmlImage';

describe('markdownHtmlImage', () => {
    it('extracts attrs from a supported wrapped html image', () => {
        expect(getMarkdownHtmlImageAttrs(
            '<p align="right"><a href="https://example.test"><img src="./assets/a.png" alt="A" width="40%" /></a></p>'
        )).toMatchObject({
            src: './assets/a.png',
            alt: 'A',
            align: 'right',
            width: '40%',
            wrapInParagraph: true,
        });
    });

    it('normalizes unsupported image alignment values', () => {
        expect(getMarkdownHtmlImageAttrs(
            '<p align="justify"><img src="./assets/a.png" align="baseline" /></p>'
        )).toMatchObject({
            src: './assets/a.png',
            align: 'center',
        });
    });

    it('rejects oversized html image fragments before parsing them', () => {
        expect(getMarkdownHtmlImageAttrs(`<img src="./assets/a.png" alt="${'x'.repeat(64 * 1024)}" />`)).toBeNull();
    });

    it('rejects overly deep html image wrappers', () => {
        const markup = `${'<span>'.repeat(40)}<img src="./assets/a.png" />${'</span>'.repeat(40)}`;

        expect(getMarkdownHtmlImageAttrs(markup)).toBeNull();
    });

    it('rejects too many html image child nodes without materializing childNodes', () => {
        const arrayFromSpy = vi.spyOn(Array, 'from');
        const markup = [
            '<picture>',
            '<source srcset="./assets/a.webp" />'.repeat(MAX_MARKDOWN_HTML_IMAGE_CHILD_SCAN_NODES + 1),
            '<img src="./assets/a.png" />',
            '</picture>',
        ].join('');

        try {
            expect(getMarkdownHtmlImageAttrs(markup)).toBeNull();
            expect(arrayFromSpy).not.toHaveBeenCalled();
        } finally {
            arrayFromSpy.mockRestore();
        }
    });
});
