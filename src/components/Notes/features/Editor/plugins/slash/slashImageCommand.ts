import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';

export function openImageLibrary(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  void import('./slashImageLibrarySession').then(({ openSlashImageLibrary }) => {
    openSlashImageLibrary(view, () => {
      void import('./slashFileCommands').then(({ insertImageFromFilePicker }) => (
        insertImageFromFilePicker(ctx)
      )).catch(() => undefined);
    });
  }).catch(() => undefined);
}
