import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import {
    dispatchTailBlankClickAction,
    endBlankClickPlugin,
    getTemporaryTailParagraphPos,
} from './endBlankClickPlugin';

function simulateDomEvent(view: any, type: string, event: Event) {
    let handled = false;
    view.someProp('handleDOMEvents', (handleDOMEvents: any) => {
        handled = handleDOMEvents[type]?.(view, event) || handled;
    });
    return handled;
}

describe('getTemporaryTailParagraphPos', () => {
    it('returns the position when the tracked node is the last empty paragraph', () => {
        const doc = {
            content: { size: 12 },
            nodeAt: (pos: number) => (pos === 10
                ? { type: { name: 'paragraph' }, content: { size: 0 }, nodeSize: 2 }
                : null),
        };

        expect(getTemporaryTailParagraphPos(doc, 10)).toBe(10);
    });

    it('returns null when the tracked node is not the trailing empty paragraph', () => {
        const doc = {
            content: { size: 12 },
            nodeAt: (pos: number) => {
                if (pos === 8) {
                    return { type: { name: 'paragraph' }, content: { size: 0 }, nodeSize: 2 };
                }
                if (pos === 10) {
                    return { type: { name: 'paragraph' }, content: { size: 1 }, nodeSize: 2 };
                }
                return null;
            },
        };

        expect(getTemporaryTailParagraphPos(doc, 8)).toBeNull();
        expect(getTemporaryTailParagraphPos(doc, 10)).toBeNull();
        expect(getTemporaryTailParagraphPos(doc, null)).toBeNull();
    });
});

describe('endBlankClickPlugin', () => {
    it('does not map a removed temporary tail paragraph selection onto the previous markdown blank line', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, [
                    'Alpha',
                    '',
                    '<!--vlaina-markdown-blank-line-->',
                ].join('\n'));
            })
            .use(commonmark)
            .use(gfm)
            .use(endBlankClickPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        try {
            expect(dispatchTailBlankClickAction(view)).toBe(true);
            expect(view.state.selection).toBeInstanceOf(TextSelection);

            expect(simulateDomEvent(view, 'blur', new Event('blur'))).toBe(false);

            expect(view.state.selection).toBeInstanceOf(TextSelection);
            expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
            expect(view.dom.querySelector('.ProseMirror-selectednode')).toBeNull();
        } finally {
            await editor.destroy();
        }
    });

    it('keeps appendTransaction cleanup from selecting the previous markdown blank line', async () => {
        const editor = Editor.make()
            .config((ctx) => {
                ctx.set(defaultValueCtx, [
                    'Alpha',
                    '',
                    '<!--vlaina-markdown-blank-line-->',
                ].join('\n'));
            })
            .use(commonmark)
            .use(gfm)
            .use(endBlankClickPlugin);

        await editor.create();
        const view = editor.ctx.get(editorViewCtx);

        try {
            expect(dispatchTailBlankClickAction(view)).toBe(true);
            expect(view.state.selection).toBeInstanceOf(TextSelection);

            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));

            expect(view.state.selection).toBeInstanceOf(TextSelection);
            expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
            expect(view.dom.querySelector('.ProseMirror-selectednode')).toBeNull();
        } finally {
            await editor.destroy();
        }
    });
});
