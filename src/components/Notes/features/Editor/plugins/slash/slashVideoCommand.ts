import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { logNotesDebug } from '@/stores/notes/debugLog';
import { getElectronBridge } from '@/lib/electron/bridge';
import { parseVideoUrl, sanitizeVideoDebugPayload } from '../video';
import { findInsertedNodePos } from './slashInsertUtils';
import { openSlashVideoPrompt } from './slashVideoPrompt';

function logSlashVideoDebug(event: string, payload: Record<string, unknown>) {
  const debugPayload = sanitizeVideoDebugPayload(payload);
  logNotesDebug(`slashCommand:${event}`, debugPayload);
  console.info(`[slashCommand:${event}]`, debugPayload);
}

function insertVideoNode(ctx: Ctx, src: string) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const videoType = state.schema.nodes.video;
  const paragraphType = state.schema.nodes.paragraph;
  const startedAt = performance.now();
  if (!videoType) {
    logSlashVideoDebug('video_insert_missing_schema', {
      src,
      schemaNodes: Object.keys(state.schema.nodes),
    });
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

    dispatch(tr.scrollIntoView());
    return nodePos;
  } catch (error) {
    logSlashVideoDebug('video_insert_error', {
      src,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    });
    console.warn('[SlashMenu] Failed to insert video:', error);
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
  const startedAt = performance.now();
  if (!videoType || previousSrc === nextSrc) {
    if (!videoType) {
      logSlashVideoDebug('video_update_skipped', {
        insertedPos,
        reason: 'missingSchema',
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      });
    }
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
    let visitedVideoNodes = 0;
    view.state.doc.descendants((node: any, pos: number) => {
      if (nodePos !== null) return false;
      if (node.type === videoType && node.attrs.src === previousSrc) {
        nodePos = pos;
        return false;
      }
      if (node.type === videoType) {
        visitedVideoNodes += 1;
      }
      return undefined;
    });
    if (nodePos === null) {
      logSlashVideoDebug('video_update_fallback_scan_missed', {
        insertedPos,
        visitedVideoNodes,
      });
    }
  }

  if (nodePos === null) {
    logSlashVideoDebug('video_update_skipped', {
      insertedPos,
      reason: 'nodeNotFound',
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    });
    return false;
  }

  const node = view.state.doc.nodeAt(nodePos);
  if (!node || node.type !== videoType) {
    logSlashVideoDebug('video_update_skipped', {
      insertedPos,
      nodePos,
      reason: 'nodeInvalid',
      foundType: node?.type.name ?? null,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    });
    return false;
  }

  view.dispatch(
    view.state.tr.setNodeMarkup(nodePos, undefined, {
      ...node.attrs,
      src: nextSrc,
    })
  );
  logSlashVideoDebug('video_update_dispatched', {
    insertedPos,
    nodePos,
    previousSrc,
    nextSrc,
    durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
  });
  return true;
}

async function resolveVideoUrlForInsert(url: string) {
  const startedAt = performance.now();
  const parsed = parseVideoUrl(url);
  if (parsed?.type === 'bilibili') {
    return {
      resolvedUrl: url,
      source: 'unchanged',
      stage: 'playable-bilibili-embed',
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    } as const;
  }

  const mediaBridge = getElectronBridge()?.media;
  if (!mediaBridge?.resolveVideoUrl) {
    logSlashVideoDebug('video_resolve_unavailable', {
      url,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    });
    return {
      resolvedUrl: url,
      source: 'unavailable',
    } as const;
  }

  try {
    const resolved = await mediaBridge.resolveVideoUrl(url);
    return resolved;
  } catch (error) {
    logSlashVideoDebug('video_resolve_error', {
      url,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    });
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
      const startedAt = performance.now();
      const insertedPos = insertVideoNode(ctx, url);
      void resolveVideoUrlForInsert(url).then((resolved) => {
        const updated = resolved.resolvedUrl === url
          ? false
          : updateInsertedVideoNodeSrc({
              view,
              insertedPos,
              previousSrc: url,
              nextSrc: resolved.resolvedUrl,
            });
        if (updated) {
          logSlashVideoDebug('video_resolve_updated', {
            url,
            resolved,
            insertedPos,
            totalElapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
          });
        }
      });
    },
  });
}
