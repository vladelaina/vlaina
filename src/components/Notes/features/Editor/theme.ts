import { rootCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { applySchemaThemeOverrides } from './themeSchemaOverrides';

const MARKDOWN_EDITOR_ROOT_CLASS = [
    'markdown-surface',
    'done',
    'max',
    'markdown-preview-view',
    'markdown-rendered',
    'markdown-reading-view',
    'markdown-preview-section',
    'markdown-source-view',
    'cm-s-obsidian',
    'mod-cm6',
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
