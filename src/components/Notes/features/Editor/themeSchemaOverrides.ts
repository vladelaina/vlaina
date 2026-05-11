import type { Ctx } from '@milkdown/kit/ctx';
import { applyFootnoteSchemaOverrides } from './themeFootnoteSchemaOverrides';
import { applyListMediaTableSchemaOverrides } from './themeListMediaTableSchemaOverrides';
import { applyTextSchemaOverrides } from './themeTextSchemaOverrides';

export function applySchemaThemeOverrides(ctx: Ctx) {
    applyTextSchemaOverrides(ctx);
    applyListMediaTableSchemaOverrides(ctx);
    applyFootnoteSchemaOverrides(ctx);
}
