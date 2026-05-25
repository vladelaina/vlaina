import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { getElectronBridge } from '@/lib/electron/bridge';
import { parseVideoUrl } from '../video';
import { findInsertedNodePos } from './slashInsertUtils';
import { openSlashVideoPrompt } from './slashVideoPrompt';

function markSlashUserInput(view: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  view.dom?.dispatchEvent?.(new CustomEvent('vlaina:block-user-input', { bubbles: true }));
}

function insertVideoNode(ctx: Ctx, src: string) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const videoType = state.schema.nodes.video;
  const paragraphType = state.schema.nodes.paragraph;
  if (!videoType) {
    return null;
  }

  try {
    const videoNode = videoType.create({ src });
    const tr = state.tr.replaceSelectionWith(videoNode);
    const preferredPos = tr.mapping.map(state.selection.from, -1);
    const nodePos = findInsertedNodePos({
      doc: tr.doc,
      preferredPos,
      nodeTypeName: 'video',
    });
    const insertedNode = tr.doc.nodeAt(nodePos);
    const afterVideoPos = nodePos + (insertedNode?.nodeSize ?? videoNode.nodeSize);
    const nextNode = tr.doc.nodeAt(afterVideoPos);

    if (nextNode?.isTextblock) {
      tr.setSelection(TextSelection.create(tr.doc, afterVideoPos + 1));
    } else if (paragraphType) {
      tr.insert(afterVideoPos, paragraphType.create());
      tr.setSelection(TextSelection.create(tr.doc, afterVideoPos + 1));
    }

    markSlashUserInput(view);
    dispatch(tr.scrollIntoView());
    return nodePos;
  } catch (error) {
    return null;
  }
}

function normalizeBilibiliEmbedForUpdate(src: string) {
  const parsed = parseVideoUrl(src);
  if (parsed?.type !== 'bilibili') return null;

  try {
    const embedUrl = new URL(parsed.embedUrl);
    embedUrl.searchParams.delete('aid');
    embedUrl.searchParams.delete('cid');
    return embedUrl.toString();
  } catch {
    return null;
  }
}

export function shouldSkipResolvedVideoUpdate(previousSrc: string, nextSrc: string) {
  if (previousSrc === nextSrc) return true;

  const previousEmbed = normalizeBilibiliEmbedForUpdate(previousSrc);
  const nextEmbed = normalizeBilibiliEmbedForUpdate(nextSrc);
  return previousEmbed !== null && previousEmbed === nextEmbed;
}

function updateInsertedVideoNodeSrc(args: {
  view: EditorView;
  insertedPos: number | null;
  previousSrc: string;
  nextSrc: string;
}) {
  const { view, insertedPos, previousSrc, nextSrc } = args;
  const videoType = view.state.schema.nodes.video;
  if (!videoType || previousSrc === nextSrc) {
    return false;
  }
  if (shouldSkipResolvedVideoUpdate(previousSrc, nextSrc)) {
    return false;
  }

  let nodePos: number | null = null;
  const directNode = typeof insertedPos === 'number' ? view.state.doc.nodeAt(insertedPos) : null;
  if (directNode?.type === videoType && directNode.attrs.src === previousSrc) {
    nodePos = insertedPos;
  }

  if (nodePos === null) {
    view.state.doc.descendants((node: any, pos: number) => {
      if (nodePos !== null) return false;
      if (node.type === videoType && node.attrs.src === previousSrc) {
        nodePos = pos;
        return false;
      }
      return undefined;
    });
  }

  if (nodePos === null) {
    return false;
  }

  const node = view.state.doc.nodeAt(nodePos);
  if (!node || node.type !== videoType) {
    return false;
  }

  markSlashUserInput(view);
  view.dispatch(
    view.state.tr.setNodeMarkup(nodePos, undefined, {
      ...node.attrs,
      src: nextSrc,
    })
  );
  return true;
}

async function resolveVideoUrlForInsert(url: string) {
  const parsed = parseVideoUrl(url);
  if (parsed?.type === 'bilibili') {
    return {
      resolvedUrl: url,
      source: 'unchanged',
      stage: 'playable-bilibili-embed',
    } as const;
  }

  const mediaBridge = getElectronBridge()?.media;
  if (!mediaBridge?.resolveVideoUrl) {
    return {
      resolvedUrl: url,
      source: 'unavailable',
    } as const;
  }

  try {
    const resolved = await mediaBridge.resolveVideoUrl(url);
    return resolved;
  } catch (error) {
    return {
      resolvedUrl: url,
      source: 'error',
      error: error instanceof Error ? error.message : String(error),
    } as const;
  }
}

export function openVideoPrompt(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  openSlashVideoPrompt({
    view,
    onSubmit: (url) => {
      const insertedPos = insertVideoNode(ctx, url);
      void resolveVideoUrlForInsert(url).then((resolved) => {
        if (resolved.resolvedUrl !== url) {
          updateInsertedVideoNodeSrc({
              view,
              insertedPos,
              previousSrc: url,
              nextSrc: resolved.resolvedUrl,
            });
        }
      });
    },
  });
}
