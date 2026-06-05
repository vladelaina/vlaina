import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import type { Decoration } from '@milkdown/kit/prose/view';
import { autolinkPlugin, autolinkPluginKey, findUrls } from './autolinkPlugin';

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
});
