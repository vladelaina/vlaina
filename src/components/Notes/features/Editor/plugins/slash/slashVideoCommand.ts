import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { getElectronBridge } from '@/lib/electron/bridge';
import { parseVideoUrl, sanitizeVideoUrlInput } from '../video';
import {
  findInsertedNodePos,
  replaceSelectionOrCurrentBlankTextBlockWithNode,
} from './slashInsertUtils';
import { openSlashVideoPrompt } from './slashVideoPrompt';

function markSlashUserInput(view: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  view.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

function insertVideoNode(ctx: Ctx, src: string) {
  const safeSrc = sanitizeVideoUrlInput(src);
  if (!safeSrc) return null;

  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const videoType = state.schema.nodes.video;
  const paragraphType = state.schema.nodes.paragraph;
  if (!videoType) {
    return null;
  }

  try {
    const videoNode = videoType.create({ src: safeSrc });
    const tr = replaceSelectionOrCurrentBlankTextBlockWithNode(state, videoNode);
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

function hasBilibiliPlaybackCid(src: string) {
  try {
    const url = new URL(src);
    return url.hostname.replace(/^www\./, '') === 'player.bilibili.com'
      && Boolean(url.searchParams.get('cid'));
  } catch {
    return false;
  }
}

export function shouldSkipResolvedVideoUpdate(previousSrc: string, nextSrc: string) {
  if (previousSrc === nextSrc) return true;

  const previousEmbed = normalizeBilibiliEmbedForUpdate(previousSrc);
  const nextEmbed = normalizeBilibiliEmbedForUpdate(nextSrc);
  return hasBilibiliPlaybackCid(previousSrc) && previousEmbed !== null && previousEmbed === nextEmbed;
}

export function updateInsertedVideoNodeSrc(args: {
  view: EditorView;
  insertedPos: number | null;
  previousSrc: string;
  nextSrc: string;
}) {
  const { view, insertedPos, previousSrc, nextSrc } = args;
  const safeNextSrc = sanitizeVideoUrlInput(nextSrc);
  if (!safeNextSrc) return false;

  const videoType = view.state.schema.nodes.video;
  if (!videoType || previousSrc === safeNextSrc) {
    return false;
  }
  if (shouldSkipResolvedVideoUpdate(previousSrc, safeNextSrc)) {
    return false;
  }

  if (typeof insertedPos !== 'number') {
    return false;
  }

  const nodePos = insertedPos;
  const node = view.state.doc.nodeAt(nodePos);
  if (!node || node.type !== videoType || node.attrs.src !== previousSrc) {
    return false;
  }

  markSlashUserInput(view);
  view.dispatch(
    view.state.tr.setNodeMarkup(nodePos, undefined, {
      ...node.attrs,
      src: safeNextSrc,
    })
  );
  return true;
}

async function resolveVideoUrlForInsert(url: string) {
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
      }).catch(() => undefined);
    },
  });
}
