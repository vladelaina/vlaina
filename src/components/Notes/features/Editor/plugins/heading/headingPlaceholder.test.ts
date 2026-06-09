import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import {
    createHeadingPlaceholderDecorations,
    getHeadingPlaceholder,
    transactionMayAffectHeadingPlaceholders,
} from './headingPlaceholder';

async function createEditor(markdown = '') {
    const editor = Editor.make()
        .config((ctx) => {
            ctx.set(defaultValueCtx, markdown);
        })
        .use(commonmark);

    await editor.create();
    return editor;
}

describe('getHeadingPlaceholder', () => {
    it('returns placeholder by heading level', () => {
        expect(getHeadingPlaceholder(1)).toBe('Heading 1');
        expect(getHeadingPlaceholder(2)).toBe('Heading 2');
        expect(getHeadingPlaceholder(3)).toBe('Heading 3');
        expect(getHeadingPlaceholder(4)).toBe('Heading 4');
        expect(getHeadingPlaceholder(5)).toBe('Heading 5');
        expect(getHeadingPlaceholder(6)).toBe('Heading 6');
    });

    it('clamps unsupported levels into 1~6', () => {
        expect(getHeadingPlaceholder(0)).toBe('Heading 1');
        expect(getHeadingPlaceholder(-3)).toBe('Heading 1');
        expect(getHeadingPlaceholder(9)).toBe('Heading 6');
    });

    it('caps empty heading placeholder decorations', async () => {
        const editor = await createEditor();
        const view = editor.ctx.get(editorViewCtx);
        const { schema } = view.state;
        const heading = schema.nodes.heading;
        const nodes = Array.from({ length: 1005 }, () => heading.create({ level: 2 }));

        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodes));

        expect(createHeadingPlaceholderDecorations(view.state.doc).find()).toHaveLength(1000);

        await editor.destroy();
    });

    it('does not decorate non-empty headings', async () => {
        const editor = await createEditor('# Heading');
        const view = editor.ctx.get(editorViewCtx);

        expect(createHeadingPlaceholderDecorations(view.state.doc).find()).toHaveLength(0);

        await editor.destroy();
    });

    it('allows ordinary paragraph input to map existing decorations without rescanning headings', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const oldState = view.state;
        const tr = oldState.tr.insertText(' typed', oldState.doc.content.size - 1);

        expect(
            transactionMayAffectHeadingPlaceholders(
                createHeadingPlaceholderDecorations(oldState.doc),
                tr,
                oldState.doc,
                tr.doc,
            ),
        ).toBe(false);

        await editor.destroy();
    });

    it('rescans heading placeholders when input can change heading structure', async () => {
        const editor = await createEditor('Body');
        const view = editor.ctx.get(editorViewCtx);
        const oldState = view.state;
        const tr = oldState.tr.insertText('#', 1);

        expect(
            transactionMayAffectHeadingPlaceholders(
                createHeadingPlaceholderDecorations(oldState.doc),
                tr,
                oldState.doc,
                tr.doc,
            ),
        ).toBe(true);

        await editor.destroy();
    });
});
