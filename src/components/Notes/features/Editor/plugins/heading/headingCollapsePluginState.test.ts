import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import {
    buildHeadingCollapsePluginState,
    canMapHeadingCollapsePluginState,
    mapHeadingCollapsePluginState,
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

function findTextEndPosition(doc: any, text: string): number {
    let position = -1;
    doc.descendants((node: any, pos: number) => {
        if (!node.isText || typeof node.text !== 'string') return true;
        const index = node.text.indexOf(text);
        if (index < 0) return true;
        position = pos + index + text.length;
        return false;
    });
    if (position < 0) {
        throw new Error(`Text not found: ${text}`);
    }
    return position;
}

describe('headingCollapsePluginState', () => {
    it('allows ordinary paragraph input after the last heading to map collapse decorations', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set(), () => undefined);
        const tr = view.state.tr.insertText(' typed', view.state.doc.content.size - 1);

        expect(canMapHeadingCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(true);

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

        expect(canMapHeadingCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(false);

        await editor.destroy();
    });

    it('maps ordinary paragraph input between headings and updates cached top-level positions', async () => {
        const editor = await createEditor('# First\n\nBody\n\n# Second\n\nTail');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set(), () => undefined);
        const tr = view.state.tr.insertText(' typed', findTextEndPosition(view.state.doc, 'Body'));

        expect(canMapHeadingCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(true);

        const mapped = mapHeadingCollapsePluginState(pluginState, tr, tr.doc);
        const secondHeading = mapped.topLevelNodes.find((nodeInfo) => (
            nodeInfo.node.type.name === 'heading' && (nodeInfo.node as any).textContent === 'Second'
        ));

        expect(secondHeading?.pos).toBe(
            pluginState.topLevelNodes.find((nodeInfo) => (
                nodeInfo.node.type.name === 'heading' && (nodeInfo.node as any).textContent === 'Second'
            ))!.pos + ' typed'.length
        );

        await editor.destroy();
    });

    it('maps ordinary paragraph hashtag input without rebuilding heading decorations', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set(), () => undefined);
        const tr = view.state.tr.insertText(' #tag', findTextEndPosition(view.state.doc, 'Body'));

        expect(canMapHeadingCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(true);

        await editor.destroy();
    });

    it('rescans when input can change heading structure', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const pluginState = buildHeadingCollapsePluginState(view.state.doc, new Set(), () => undefined);
        const tr = view.state.tr.insertText('\n# Next', view.state.doc.content.size - 1);

        expect(canMapHeadingCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(false);

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

        expect(canMapHeadingCollapsePluginState(pluginState, tr, view.state.doc, tr.doc)).toBe(false);

        await editor.destroy();
    });
});
