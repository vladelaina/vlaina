import { describe, expect, it, vi } from 'vitest';
import * as ProseModel from '@milkdown/kit/prose/model';
import * as ProseState from '@milkdown/kit/prose/state';
import {
    getBoundedTextNodeLength,
    getBoundedLinkTooltipText,
    MAX_TOOLTIP_FALLBACK_LINK_TEXT_CHARS,
    MAX_TOOLTIP_FALLBACK_LINK_TEXT_NODES,
    editExistingLink,
    editLinkAtPosition,
    removeExistingLink,
    sanitizeTooltipLinkHref,
} from './linkTooltipTransactions';

const SchemaCtor = (ProseModel as any).Schema;
const EditorStateCtor = (ProseState as any).EditorState;
const schema = new SchemaCtor({
    nodes: {
        doc: { content: 'block+' },
        paragraph: {
            group: 'block',
            content: 'inline*',
            toDOM: () => ['p', 0],
            parseDOM: [{ tag: 'p' }],
        },
        text: { group: 'inline' },
    },
    marks: {
        link: {
            attrs: { href: {} },
            inclusive: false,
            toDOM: (mark: any) => ['a', { href: mark.attrs.href }, 0],
            parseDOM: [{ tag: 'a[href]', getAttrs: (dom: HTMLElement) => ({ href: dom.getAttribute('href') }) }],
        },
    },
});

function createExistingLinkTransactionFixture() {
    const before = 'Before ';
    const linkText = 'Docs';
    const after = '! after';
    const linkMark = schema.marks.link.create({ href: 'https://example.com/old' });
    const state = EditorStateCtor.create({
        schema,
        doc: schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, [
            schema.text(before),
            schema.text(linkText, [linkMark]),
            schema.text(after),
        ])),
    });
    const linkStart = 1 + before.length;
    const linkEnd = linkStart + linkText.length;
    const link = document.createElement('a');
    link.textContent = linkText;
    let dispatchedTransaction: typeof state.tr | null = null;
    const dom = new EventTarget();
    const dispatch = vi.fn((tr: typeof state.tr) => {
        dispatchedTransaction = tr;
    });
    const view = {
        dom,
        state,
        dispatch,
        posAtDOM: vi.fn(() => linkStart),
    };

    return {
        view,
        link,
        linkStart,
        linkEnd,
        linkText,
        getDispatchedTransaction: () => dispatchedTransaction,
    };
}

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

    it('bounds link tooltip text node scans', () => {
        const link = document.createElement('a');
        for (let index = 0; index < MAX_TOOLTIP_FALLBACK_LINK_TEXT_NODES + 10; index += 1) {
            link.append(document.createTextNode(''));
        }
        link.append(document.createTextNode('over budget'));

        expect(getBoundedLinkTooltipText(link)).toBe('');
        expect(getBoundedTextNodeLength(link, MAX_TOOLTIP_FALLBACK_LINK_TEXT_CHARS)).toBeNull();
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

    it('edits an existing link without deleting the following character', () => {
        const { view, link, linkStart, linkEnd, linkText, getDispatchedTransaction } =
            createExistingLinkTransactionFixture();

        expect(editExistingLink(view as never, link, linkText, 'workspace-note')).toBe(linkStart);

        const tr = getDispatchedTransaction();
        expect(tr).not.toBeNull();
        expect(tr!.doc.textContent).toBe('Before Docs! after');
        expect(tr!.doc.rangeHasMark(linkStart, linkEnd, view.state.schema.marks.link)).toBe(true);
        expect(tr!.doc.rangeHasMark(linkEnd, linkEnd + 1, view.state.schema.marks.link)).toBe(false);
    });

    it('ignores stale link tooltip ranges without dispatching', () => {
        const { view } = createExistingLinkTransactionFixture();

        expect(editLinkAtPosition(view as never, 5000, 5005, 'Docs', 'https://example.com')).toBeNull();
        expect(view.dispatch).not.toHaveBeenCalled();
    });

    it('removes an existing link without deleting the following character', () => {
        const { view, link, getDispatchedTransaction } = createExistingLinkTransactionFixture();

        expect(removeExistingLink(view as never, link)).toBe(true);

        const tr = getDispatchedTransaction();
        expect(tr).not.toBeNull();
        expect(tr!.doc.textContent).toBe('Before ! after');
    });

    it('keeps plain non-URL href text when edited from the tooltip', () => {
        expect(sanitizeTooltipLinkHref('me')).toBe('me');
        expect(sanitizeTooltipLinkHref('workspace-note')).toBe('workspace-note');
        expect(sanitizeTooltipLinkHref('docs/readme')).toBe('docs/readme');
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

    it('rejects credentialed HTTP links when edited from the tooltip', () => {
        expect(sanitizeTooltipLinkHref('https://user:pass@example.com/docs')).toBeNull();
    });

    it('keeps explicit relative hrefs when edited from the tooltip', () => {
        expect(sanitizeTooltipLinkHref('/docs/readme.md')).toBe('/docs/readme.md');
        expect(sanitizeTooltipLinkHref('./docs/readme.md')).toBe('./docs/readme.md');
        expect(sanitizeTooltipLinkHref('../docs/readme.md')).toBe('../docs/readme.md');
        expect(sanitizeTooltipLinkHref('#section')).toBe('#section');
    });

    it('rejects protocol-relative hrefs from the tooltip', () => {
        expect(sanitizeTooltipLinkHref('//example.com')).toBeNull();
    });

});
