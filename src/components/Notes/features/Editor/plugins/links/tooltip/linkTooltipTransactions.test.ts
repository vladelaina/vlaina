import { describe, expect, it, vi } from 'vitest';
import { editLinkAtPosition, removeExistingLink, sanitizeTooltipLinkHref } from './linkTooltipTransactions';

describe('link tooltip transactions', () => {
    it('deletes plain autolink text even when there is no link mark', () => {
        const link = document.createElement('a');
        link.className = 'autolink';
        link.textContent = 'https://example.com';

        const deleteMock = vi.fn(() => 'delete-tr');
        const dispatch = vi.fn();
        const view = {
            posAtDOM: vi.fn(() => 3),
            state: {
                doc: {
                    content: {
                        size: 64,
                    },
                    resolve: vi.fn(() => ({
                        marks: () => [],
                        nodeAfter: null,
                    })),
                },
                schema: {
                    marks: {
                        link: {
                            isInSet: vi.fn(() => null),
                        },
                    },
                },
                tr: {
                    delete: deleteMock,
                },
            },
            dispatch,
        };

        expect(removeExistingLink(view as never, link)).toBe(true);
        expect(deleteMock).toHaveBeenCalledWith(3, 22);
        expect(dispatch).toHaveBeenCalledWith('delete-tr');
    });

    it('removes the link mark when the edited href is plain text', () => {
        const removeMark = vi.fn(() => 'remove-mark-tr');
        const dispatch = vi.fn();
        const view = {
            state: {
                schema: {
                    marks: {
                        link: {},
                    },
                },
                tr: {
                    removeMark,
                },
            },
            dispatch,
        };

        expect(editLinkAtPosition(view as never, 2, 9, 'me', 'me')).toBeNull();
        expect(removeMark).toHaveBeenCalledWith(2, 9, {});
        expect(dispatch).toHaveBeenCalledWith('remove-mark-tr');
    });

    it('keeps a bare supported domain as a link when edited from the tooltip', () => {
        expect(sanitizeTooltipLinkHref('cati.me')).toBe('https://cati.me');
        expect(sanitizeTooltipLinkHref('catim.md')).toBe('https://catim.md');
    });

    it('keeps explicit relative hrefs when edited from the tooltip', () => {
        expect(sanitizeTooltipLinkHref('/docs/readme.md')).toBe('/docs/readme.md');
        expect(sanitizeTooltipLinkHref('./docs/readme.md')).toBe('./docs/readme.md');
        expect(sanitizeTooltipLinkHref('../docs/readme.md')).toBe('../docs/readme.md');
        expect(sanitizeTooltipLinkHref('#section')).toBe('#section');
    });

    it('rejects implicit relative words and protocol-relative hrefs from the tooltip', () => {
        expect(sanitizeTooltipLinkHref('me')).toBeNull();
        expect(sanitizeTooltipLinkHref('//example.com')).toBeNull();
    });

});
