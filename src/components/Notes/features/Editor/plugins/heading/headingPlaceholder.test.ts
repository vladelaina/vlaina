import { beforeEach, describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useUIStore } from '@/stores/uiSlice';
import {
    createHeadingPlaceholderDecorations,
    getHeadingPlaceholder,
    transactionMayAffectHeadingPlaceholders,
} from './headingPlaceholder';
import { HEADING_PLACEHOLDER_I18N_REFRESH_META, headingPlugin } from './headingPlugin';

type HandleTextInput = (view: EditorView, from: number, to: number, text: string) => boolean;
type HandleKeyDown = (view: EditorView, event: KeyboardEvent) => boolean;

async function createEditor(markdown = '') {
    const editor = Editor.make()
        .config((ctx) => {
            ctx.set(defaultValueCtx, markdown);
        })
        .use(commonmark);

    for (const plugin of headingPlugin) {
        editor.use(plugin);
    }

    await editor.create();
    return editor;
}

function typeText(view: EditorView, input: string) {
    for (const text of input) {
        const { from, to } = view.state.selection;
        let handled = false;

        view.someProp('handleTextInput', (handleTextInput: HandleTextInput) => {
            handled = handleTextInput(view, from, to, text) || handled;
        });

        if (!handled) view.dispatch(view.state.tr.insertText(text, from, to));
    }
}

function pressKey(view: EditorView, key: 'Backspace' | 'Delete') {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
    });
    let handled = false;

    view.someProp('handleKeyDown', (handleKeyDown: HandleKeyDown) => {
        handled = handleKeyDown(view, event) || handled;
    });

    return handled;
}

describe('getHeadingPlaceholder', () => {
    beforeEach(() => {
        useUIStore.setState({ languagePreference: 'en' });
    });

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

    it('does not coerce non-number heading levels', () => {
        const level = {
            toString() {
                throw new Error('heading level coercion');
            },
        };

        expect(getHeadingPlaceholder(level)).toBe('Heading 1');
    });

    it('returns localized placeholder copy', () => {
        useUIStore.setState({ languagePreference: 'zh-CN' });

        expect(getHeadingPlaceholder(1)).toBe('一级标题');
        expect(getHeadingPlaceholder(6)).toBe('六级标题');
    });

    it('refreshes existing heading placeholder decorations after language changes', async () => {
        const editor = await createEditor();
        const view = editor.ctx.get(editorViewCtx);

        typeText(view, '# ');
        expect(view.dom.querySelector('h1')?.getAttribute('data-placeholder')).toBe('Heading 1');

        useUIStore.setState({ languagePreference: 'zh-CN' });
        view.dispatch(
            view.state.tr
                .setMeta(HEADING_PLACEHOLDER_I18N_REFRESH_META, 'zh-CN')
                .setMeta('addToHistory', false)
        );

        expect(view.dom.querySelector('h1')?.getAttribute('data-placeholder')).toBe('一级标题');

        await editor.destroy();
    });

    it.each(['Backspace', 'Delete'] as const)('allows deleting an input-rule-created empty heading with %s', async (key) => {
        const editor = await createEditor();
        const view = editor.ctx.get(editorViewCtx);

        typeText(view, '# ');

        expect(view.state.doc.firstChild?.type.name).toBe('heading');
        expect(createHeadingPlaceholderDecorations(view.state.doc).find()).toHaveLength(1);

        expect(pressKey(view, key)).toBe(true);

        expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
        expect(createHeadingPlaceholderDecorations(view.state.doc).find()).toHaveLength(0);

        await editor.destroy();
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

    it('allows ordinary paragraph hashtag input without rescanning headings', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const oldState = view.state;
        const tr = oldState.tr.insertText(' #tag', oldState.doc.content.size - 1);

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

    it('rescans heading placeholders when input can change block structure', async () => {
        const editor = await createEditor('Body');
        const view = editor.ctx.get(editorViewCtx);
        const oldState = view.state;
        const tr = oldState.tr.insertText('\n# Next', oldState.doc.content.size - 1);

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

    it('maps heading placeholders for ordinary insertion inside a non-empty heading', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const oldState = view.state;
        const tr = oldState.tr.insertText('prefix ', 1);

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

    it('rescans heading placeholders when deleting heading text can create an empty heading', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const oldState = view.state;
        const tr = oldState.tr.delete(1, 8);

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
