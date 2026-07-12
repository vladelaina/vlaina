import { rootCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { applySchemaThemeOverrides } from './themeSchemaOverrides';
import { OBSIDIAN_EDITOR_ROOT_CLASSES } from './theme-compatibility/obsidian/runtimeClasses';

const MARKDOWN_EDITOR_ROOT_CLASS = [
    'markdown-surface',
    'done',
    'max',
    ...OBSIDIAN_EDITOR_ROOT_CLASSES,
    'is-live-preview',
    'is-readable-line-width',
    'mx-auto',
    'focus:outline-none',
    'min-h-[var(--vlaina-size-50vh)]',
    'pb-32',
    'pt-0',
].join(' ');

function applyRootThemeClasses(ctx: Ctx) {
    ctx.update(rootCtx, (root: unknown) => {
        if (root instanceof HTMLElement) {
            root.classList.add(...MARKDOWN_EDITOR_ROOT_CLASS.split(' '));
            root.id = 'write';
            root.dataset.markdownThemeRoot = 'true';
        }
        return root as HTMLElement | null;
    });
}

export function configureTheme(ctx: Ctx) {
    applySchemaThemeOverrides(ctx);

    return async () => {
        applyRootThemeClasses(ctx);
    };
}
