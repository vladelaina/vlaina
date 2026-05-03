import type { Ctx } from '@milkdown/kit/ctx';
import { applyListMediaTableSchemaOverrides } from './themeListMediaTableSchemaOverrides';
import { applyTextSchemaOverrides } from './themeTextSchemaOverrides';

export function applySchemaThemeOverrides(ctx: Ctx) {
    applyTextSchemaOverrides(ctx);
    applyListMediaTableSchemaOverrides(ctx);
}
