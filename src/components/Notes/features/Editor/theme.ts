import { rootCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { themeClasses } from './themeClasses';
import { applySchemaThemeOverrides } from './themeSchemaOverrides';

function applyRootThemeClasses(ctx: Ctx) {
    ctx.update(rootCtx, (root: unknown) => {
        if (root instanceof HTMLElement) {
            root.classList.add(...themeClasses.root.split(' '));
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
