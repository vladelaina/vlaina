import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { collapsePlugin } from './collapse';

async function createEditor(markdown: string) {
    const editor = Editor.make()
        .config((ctx) => {
            ctx.set(defaultValueCtx, markdown);
        })
        .use(commonmark)
        .use(collapsePlugin);

    await editor.create();
    return editor;
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('heading collapse decorations', () => {
    it('blurs the editor after toggling a heading collapse affordance', async () => {
        const editor = await createEditor('# Heading\n\nBody');
        const view = editor.ctx.get(editorViewCtx);
        const blurSpy = vi.spyOn(view.dom, 'blur');
        const toggle = view.dom.querySelector('.heading-toggle-btn') as HTMLElement | null;

        expect(toggle).not.toBeNull();

        toggle?.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
        }));

        expect(blurSpy).toHaveBeenCalledTimes(1);

        await editor.destroy();
    });
});
