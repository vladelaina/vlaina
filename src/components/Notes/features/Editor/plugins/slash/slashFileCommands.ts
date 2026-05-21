import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { getMimeType, isImageFilename } from '@/lib/assets/core/naming';
import { translate } from '@/lib/i18n';
import { getBaseName, getStorageAdapter } from '@/lib/storage/adapter';
import { openDialog } from '@/lib/storage/dialog';
import { handleEditorImageFiles } from '../image-upload/handleEditorImageFiles';

const MAX_PICKED_IMAGE_BYTES = 50 * 1024 * 1024;

function isInsertableImagePath(path: string) {
  return isImageFilename(path);
}

function isInsertableImageSize(size: number | null | undefined) {
  return typeof size !== 'number' || size <= MAX_PICKED_IMAGE_BYTES;
}

export async function insertImageFromFilePicker(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const insertionBookmark = view.state.selection.getBookmark();

  try {
    const selected = await openDialog({
      title: translate('editor.insertImage'),
      authorizeParentDirectory: true,
      filters: [
        {
          name: translate('editor.images'),
          extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'],
        },
      ],
    });
    const selectedPath = Array.isArray(selected) ? selected[0] : selected;
    if (!selectedPath) return;
    if (!isInsertableImagePath(selectedPath)) return;

    const storage = getStorageAdapter();
    const fileInfo = await storage.stat(selectedPath).catch(() => null);
    if (!isInsertableImageSize(fileInfo?.size ?? null)) return;

    const bytes = await storage.readBinaryFile(selectedPath);
    if (!isInsertableImageSize(bytes.byteLength)) return;
    const fileName = getBaseName(selectedPath) || 'image';
    const file = new File([new Uint8Array(bytes)], fileName, {
      type: getMimeType(fileName),
    });

    view.dispatch(
      view.state.tr
        .setSelection(insertionBookmark.resolve(view.state.doc))
        .scrollIntoView()
    );
    await handleEditorImageFiles([file], view);
  } catch (error) {
  }
}

export const __testing__ = {
  isInsertableImagePath,
  isInsertableImageSize,
};

export function insertFrontmatter(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const frontmatter = state.schema.nodes.frontmatter;
  if (!frontmatter) return;

  const firstNode = state.doc.firstChild;
  if (firstNode?.type === frontmatter) {
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1)).scrollIntoView());
    return;
  }

  const node = frontmatter.create();
  const tr = state.tr.insert(0, node);
  tr.setSelection(TextSelection.create(tr.doc, 1)).scrollIntoView();
  dispatch(tr);
}
