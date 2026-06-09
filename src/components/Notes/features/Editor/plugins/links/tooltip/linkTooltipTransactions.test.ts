import { describe, expect, it, vi } from 'vitest';
import {
    getBoundedLinkTooltipText,
    MAX_TOOLTIP_FALLBACK_LINK_TEXT_CHARS,
    editLinkAtPosition,
    removeExistingLink,
    sanitizeTooltipLinkHref,
} from './linkTooltipTransactions';

describe('link tooltip transactions', () => {
    it('reads link tooltip text without aggregate textContent', () => {
        const link = document.createElement('a');
        link.append(document.createTextNode('Docs'));
        Object.defineProperty(link, 'textContent', {
            get() {
                throw new Error('aggregate link textContent should not be read');
            },
        });

        expect(getBoundedLinkTooltipText(link)).toBe('Docs');
    });

    it('bounds link tooltip initial text reads', () => {
        const link = document.createElement('a');
        link.append(document.createTextNode('x'.repeat(MAX_TOOLTIP_FALLBACK_LINK_TEXT_CHARS + 20)));

        expect(getBoundedLinkTooltipText(link)).toHaveLength(MAX_TOOLTIP_FALLBACK_LINK_TEXT_CHARS);
    });

    it('deletes plain autolink text even when there is no link mark', () => {
        const link = document.createElement('a');
        link.className = 'autolink';
        link.textContent = 'https://example.com';
        Object.defineProperty(link, 'textContent', {
            get() {
                throw new Error('aggregate link textContent should not be read');
            },
        });

        const deleteMock = vi.fn(() => 'delete-tr');
        const dispatch = vi.fn();
        const dom = new EventTarget();
        const listener = vi.fn();
        dom.addEventListener('editor:block-user-input', listener);
        const view = {
            dom,
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
        expect(listener).toHaveBeenCalledTimes(1);
        expect(deleteMock).toHaveBeenCalledWith(3, 22);
        expect(dispatch).toHaveBeenCalledWith('delete-tr');
    });

    it('does not delete oversized plain autolink fallback text', () => {
        const link = document.createElement('a');
        link.className = 'autolink';
        link.append(document.createTextNode('x'.repeat(4097)));
        Object.defineProperty(link, 'textContent', {
            get() {
                throw new Error('aggregate link textContent should not be read');
            },
        });

        const deleteMock = vi.fn(() => 'delete-tr');
        const dispatch = vi.fn();
        const view = {
            dom: new EventTarget(),
            posAtDOM: vi.fn(() => 3),
            state: {
                doc: {
                    content: {
                        size: 8192,
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

        expect(removeExistingLink(view as never, link)).toBe(false);
        expect(deleteMock).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('removes the link mark when the edited href is plain text', () => {
        const removeMark = vi.fn(() => 'remove-mark-tr');
        const dispatch = vi.fn();
        const dom = new EventTarget();
        const listener = vi.fn();
        dom.addEventListener('editor:block-user-input', listener);
        const view = {
            dom,
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
        expect(listener).toHaveBeenCalledTimes(1);
        expect(removeMark).toHaveBeenCalledWith(2, 9, {});
        expect(dispatch).toHaveBeenCalledWith('remove-mark-tr');
    });

    it('keeps a bare supported domain as a link when edited from the tooltip', () => {
        expect(sanitizeTooltipLinkHref('cati.me')).toBe('https://cati.me');
        expect(sanitizeTooltipLinkHref('catim.md')).toBe('https://catim.md');
    });

    it('rejects local-network HTTP links when edited from the tooltip', () => {
        expect(sanitizeTooltipLinkHref('http://127.0.0.1:3000/admin')).toBeNull();
        expect(sanitizeTooltipLinkHref('http://router/admin')).toBeNull();
        expect(sanitizeTooltipLinkHref('https://example.com/docs')).toBe('https://example.com/docs');
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
