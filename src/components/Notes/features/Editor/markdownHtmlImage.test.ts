import { describe, expect, it, vi } from 'vitest';
import {
    getMarkdownHtmlImageAttrs,
    MAX_MARKDOWN_HTML_IMAGE_CHILD_SCAN_NODES,
    MAX_MARKDOWN_HTML_IMAGE_TEXT_ATTR_CHARS,
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

    it('rejects raw html images that point at internal note folders', () => {
        expect(getMarkdownHtmlImageAttrs('<img src=".vlaina/assets/demo.png" />')).toBeNull();
        expect(getMarkdownHtmlImageAttrs('<img src="./docs/.GIT/demo.png" />')).toBeNull();
        expect(getMarkdownHtmlImageAttrs('<img src="docs/%252egit/demo.png" />')).toBeNull();
        expect(getMarkdownHtmlImageAttrs('<img src=".notes/demo.png" />')).toMatchObject({
            src: '.notes/demo.png',
        });
    });

    it('rejects oversized html image fragments before parsing them', () => {
        expect(getMarkdownHtmlImageAttrs(`<img src="./assets/a.png" alt="${'x'.repeat(64 * 1024)}" />`)).toBeNull();
    });

    it('bounds html image text attributes after parsing valid fragments', () => {
        const attrs = getMarkdownHtmlImageAttrs(
            `<img src="./assets/a.png" alt="${'x'.repeat(MAX_MARKDOWN_HTML_IMAGE_TEXT_ATTR_CHARS + 1)}" title="${'y'.repeat(MAX_MARKDOWN_HTML_IMAGE_TEXT_ATTR_CHARS + 1)}" />`
        );

        expect(attrs?.alt).toHaveLength(MAX_MARKDOWN_HTML_IMAGE_TEXT_ATTR_CHARS);
        expect(attrs?.title).toHaveLength(MAX_MARKDOWN_HTML_IMAGE_TEXT_ATTR_CHARS);
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
