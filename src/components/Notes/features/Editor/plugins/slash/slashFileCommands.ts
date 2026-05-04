import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { getMimeType } from '@/lib/assets/core/naming';
import { getBaseName, getStorageAdapter } from '@/lib/storage/adapter';
import { openDialog } from '@/lib/storage/dialog';
import { handleEditorImageFiles } from '../image-upload/handleEditorImageFiles';

export async function insertImageFromFilePicker(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const insertionBookmark = view.state.selection.getBookmark();

  try {
    const selected = await openDialog({
      title: 'Insert Image',
      authorizeParentDirectory: true,
      filters: [
        {
          name: 'Images',
          extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'],
        },
      ],
    });
    const selectedPath = Array.isArray(selected) ? selected[0] : selected;
    if (!selectedPath) return;

    const bytes = await getStorageAdapter().readBinaryFile(selectedPath);
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
    console.warn('[SlashMenu] Failed to insert image:', error);
  }
}

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
