import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import {
    buildHeadingCollapsePluginState,
    canMapHeadingCollapsePluginState,
} from './headingCollapsePluginState';

async function createEditor(markdown: string) {
    const editor = Editor.make()
        .config((ctx) => {
            ctx.set(defaultValueCtx, markdown);
        })
        .use(commonmark);

    await editor.create();
    return editor;
}

describe('headingCollapsePluginState', () => {
    it('allows ordinary paragraph input after the last heading to map collapse decorations', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set(), () => undefined);
        const tr = view.state.tr.insertText(' typed', view.state.doc.content.size - 1);

        expect(canMapHeadingCollapsePluginState(pluginState, tr)).toBe(true);

        await editor.destroy();
    });

    it('allows ordinary hashtag input after the last heading to map collapse decorations', async () => {
        const editor = await createEditor('# Heading\n\nBody ');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set(), () => undefined);
        const tr = view.state.tr.insertText('#tag', view.state.doc.content.size - 1);

        expect(canMapHeadingCollapsePluginState(pluginState, tr)).toBe(true);

        await editor.destroy();
    });

    it('rescans when input can move existing heading toggle positions', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set(), () => undefined);
        const tr = view.state.tr.insertText('prefix ', 1);

        expect(canMapHeadingCollapsePluginState(pluginState, tr)).toBe(false);

        await editor.destroy();
    });

    it('rescans when input can change heading structure', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set(), () => undefined);
        const tr = view.state.tr.insertText('\n# Next', view.state.doc.content.size - 1);

        expect(canMapHeadingCollapsePluginState(pluginState, tr)).toBe(false);

        await editor.destroy();
    });

    it('rescans when hash input can create a markdown heading prefix', async () => {
        const editor = await createEditor('Body');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set(), () => undefined);
        const tr = view.state.tr.insertText('# ', 1);

        expect(canMapHeadingCollapsePluginState(pluginState, tr)).toBe(false);

        await editor.destroy();
    });

    it('rescans while any heading is collapsed', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set([0]), () => undefined);
        const tr = view.state.tr.insertText(' typed', view.state.doc.content.size - 1);

        expect(canMapHeadingCollapsePluginState(pluginState, tr)).toBe(false);

        await editor.destroy();
    });
});
