import { describe, expect, it } from 'vitest';
import { findUrls } from './autolinkPlugin';

describe('autolinkPlugin findUrls', () => {
    it('detects bare domains with supported TLDs', () => {
        expect(findUrls('open cati.me and catim.md and example.xn--p1ai please', 0)).toEqual([
            {
                start: 5,
                end: 12,
                url: 'cati.me',
                href: 'https://cati.me',
            },
            {
                start: 17,
                end: 25,
                url: 'catim.md',
                href: 'https://catim.md',
            },
            {
                start: 30,
                end: 46,
                url: 'example.xn--p1ai',
                href: 'https://example.xn--p1ai',
            },
        ]);
    });

    it('does not treat a plain TLD word as a URL', () => {
        expect(findUrls('me', 0)).toEqual([]);
    });

    it('does not duplicate bare domain matches inside full URLs', () => {
        expect(findUrls('https://cati.me and cati.me', 0)).toEqual([
            {
                start: 0,
                end: 15,
                url: 'https://cati.me',
                href: 'https://cati.me',
            },
            {
                start: 20,
                end: 27,
                url: 'cati.me',
                href: 'https://cati.me',
            },
        ]);
    });

    it('keeps balanced parentheses in URLs while trimming sentence punctuation', () => {
        expect(findUrls('see https://example.com/a_(b).', 0)).toEqual([
            {
                start: 4,
                end: 29,
                url: 'https://example.com/a_(b)',
                href: 'https://example.com/a_(b)',
            },
        ]);
    });

    it('trims only unmatched trailing closing parentheses', () => {
        expect(findUrls('(https://example.com/a_(b))', 0)).toEqual([
            {
                start: 1,
                end: 26,
                url: 'https://example.com/a_(b)',
                href: 'https://example.com/a_(b)',
            },
        ]);
    });
});
