import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import type { Decoration } from '@milkdown/kit/prose/view';
import {
    MAX_AUTOLINK_DECORATIONS,
    MAX_AUTOLINK_TEXT_SCAN_CHARS,
    MAX_AUTOLINK_TRANSACTION_STEP_TEXT_CHARS,
    autolinkPlugin,
    autolinkPluginKey,
    collectAutolinkDecorations,
    findUrls,
    transactionMayCreateAutolink,
    transactionMayAffectExistingAutolinks,
} from './autolinkPlugin';

interface FakeAutolinkNode {
    child?: (index: number) => FakeAutolinkNode | null | undefined;
    childCount?: number;
    isText?: boolean;
    nodeSize?: number;
    text?: string;
    type?: { name?: string };
}

function createTextNode(text: string): FakeAutolinkNode {
    return {
        isText: true,
        nodeSize: text.length,
        text,
        type: { name: 'text' },
    };
}

function createDocNode(children: FakeAutolinkNode[], onAccess?: () => void): FakeAutolinkNode & {
    resolve: () => { marks: () => unknown[] };
} {
    return {
        childCount: children.length,
        child(index) {
            onAccess?.();
            return children[index];
        },
        resolve: () => ({ marks: () => [] }),
        type: { name: 'doc' },
    };
}

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

    it('can stop URL scanning after the requested match budget', () => {
        expect(findUrls('a.com b.com c.com', 0, 2)).toEqual([
            {
                start: 0,
                end: 5,
                url: 'a.com',
                href: 'https://a.com',
            },
            {
                start: 6,
                end: 11,
                url: 'b.com',
                href: 'https://b.com',
            },
        ]);
    });

    it('decorates ordinary URLs without touching inline or block code', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, [
                    'Open https://example.com and `https://code.example`.',
                    '',
                    '```',
                    'https://block.example',
                    '```',
                ].join('\n'));
            })
            .use(commonmark)
            .use(autolinkPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);
        const decorations = autolinkPluginKey.getState(view.state)?.find() ?? [];

        expect(decorations.map((decoration: Decoration) => ({
            text: view.state.doc.textBetween(decoration.from, decoration.to),
            href: (decoration.type as any).attrs?.href,
        }))).toEqual([{
            text: 'https://example.com',
            href: 'https://example.com',
        }]);

        await editor.destroy();
    });

    it('does not decorate local network URLs', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, 'Open http://127.0.0.1:3000 and https://example.com');
            })
            .use(commonmark)
            .use(autolinkPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);
        const decorations = autolinkPluginKey.getState(view.state)?.find() ?? [];

        expect(decorations.map((decoration: Decoration) => ({
            text: view.state.doc.textBetween(decoration.from, decoration.to),
            href: (decoration.type as any).attrs?.href,
        }))).toEqual([{
            text: 'https://example.com',
            href: 'https://example.com',
        }]);

        await editor.destroy();
    });

    it('caps generated URL decorations', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, Array.from(
                    { length: 1005 },
                    (_, index) => `https://example-${index}.com`
                ).join(' '));
            })
            .use(commonmark)
            .use(autolinkPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        expect(autolinkPluginKey.getState(view.state)?.find()).toHaveLength(1000);

        await editor.destroy();
    });

    it('stops scanning document nodes after the decoration cap is reached', () => {
        let accessed = 0;
        const children: FakeAutolinkNode[] = [];
        for (let index = 0; index < MAX_AUTOLINK_DECORATIONS + 2; index += 1) {
            children.push(createTextNode(`https://example-${index}.com`));
        }

        const decorations = collectAutolinkDecorations(createDocNode(children, () => {
            accessed += 1;
        }));

        expect(decorations).toHaveLength(MAX_AUTOLINK_DECORATIONS);
        expect(accessed).toBe(MAX_AUTOLINK_DECORATIONS);
    });

    it('bounds URL scanning within a single large text node', () => {
        const text = `${'x'.repeat(MAX_AUTOLINK_TEXT_SCAN_CHARS)} https://example.com`;
        const decorations = collectAutolinkDecorations(createDocNode([createTextNode(text)]));

        expect(decorations).toHaveLength(0);
    });

    it('does not treat plain edits away from existing autolinks as affecting autolinks', () => {
        const decorations = {
            find: (from?: number, to?: number) =>
                (from ?? 0) < 20 && (to ?? 0) > 10 ? [{}] : [],
        };
        const transaction = {
            mapping: {
                maps: [{
                    forEach: (callback: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void) => {
                        callback(80, 80, 80, 81);
                    },
                }],
            },
        };

        expect(transactionMayAffectExistingAutolinks(decorations, transaction)).toBe(false);
    });

    it('treats edits touching an existing autolink edge as affecting autolinks', () => {
        const decorations = {
            find: (from?: number, to?: number) =>
                (from ?? 0) < 20 && (to ?? 0) > 10 ? [{}] : [],
        };
        const transaction = {
            mapping: {
                maps: [{
                    forEach: (callback: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void) => {
                        callback(20, 20, 20, 21);
                    },
                }],
            },
        };

        expect(transactionMayAffectExistingAutolinks(decorations, transaction)).toBe(true);
    });

    it('bounds inserted transaction text checks for autolinks', () => {
        const smallContent = {
            size: 12,
            textBetween: vi.fn(() => 'plain text'),
        };
        const largeContent = {
            size: MAX_AUTOLINK_TRANSACTION_STEP_TEXT_CHARS + 1,
            textBetween: vi.fn(() => {
                throw new Error('oversized autolink transaction text should not be read');
            }),
        };

        expect(transactionMayCreateAutolink({ steps: [{ slice: { content: smallContent } }] })).toBe(false);
        expect(smallContent.textBetween).toHaveBeenCalledWith(0, 12, '\n', '\ufffc');
        expect(transactionMayCreateAutolink({ steps: [{ slice: { content: largeContent } }] })).toBe(true);
        expect(largeContent.textBetween).not.toHaveBeenCalled();
    });
});
