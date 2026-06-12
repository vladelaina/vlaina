import { serializerCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { Plugin } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';

type MarkdownSerializer = (doc: unknown) => string;

interface DeferredMarkdownUpdateControllerOptions {
  delayMs?: number;
  onMarkdownUpdated: (markdown: string) => void;
  serializeDoc: MarkdownSerializer;
  shouldSerialize?: () => boolean;
}

export const DEFAULT_DEFERRED_MARKDOWN_SERIALIZE_DELAY_MS =
  themeUiFeedbackTokens.editorMarkdownSerializationDebounceMs;
export const LARGE_DOC_DEFERRED_MARKDOWN_NODE_SIZE = 30_000;
export const LARGE_DOC_DEFERRED_MARKDOWN_SERIALIZE_DELAY_MS = Math.max(
  DEFAULT_DEFERRED_MARKDOWN_SERIALIZE_DELAY_MS * 4,
  2_000
);

export function getDeferredMarkdownSerializeDelayMs(doc: ProseNode, baseDelayMs: number): number {
  const docSize = (doc as { content?: { size?: number } }).content?.size ?? 0;
  return docSize >= LARGE_DOC_DEFERRED_MARKDOWN_NODE_SIZE
    ? Math.max(baseDelayMs, LARGE_DOC_DEFERRED_MARKDOWN_SERIALIZE_DELAY_MS)
    : baseDelayMs;
}

export function createDeferredMarkdownUpdateController({
  delayMs = DEFAULT_DEFERRED_MARKDOWN_SERIALIZE_DELAY_MS,
  onMarkdownUpdated,
  serializeDoc,
  shouldSerialize = () => true,
}: DeferredMarkdownUpdateControllerOptions) {
  let pendingDoc: ProseNode | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const clearPendingTimer = () => {
    if (pendingTimer === null) {
      return;
    }
    clearTimeout(pendingTimer);
    pendingTimer = null;
  };

  const flush = () => {
    clearPendingTimer();
    if (destroyed || pendingDoc === null) {
      return;
    }
    if (!shouldSerialize()) {
      pendingDoc = null;
      return;
    }

    const doc = pendingDoc;
    pendingDoc = null;
    let markdown: string;
    try {
      markdown = serializeDoc(doc);
    } catch {
      return;
    }
    onMarkdownUpdated(markdown);
  };

  const schedule = (doc: ProseNode) => {
    if (destroyed) {
      return;
    }
    if (!shouldSerialize()) {
      pendingDoc = null;
      clearPendingTimer();
      return;
    }

    pendingDoc = doc;
    clearPendingTimer();
    pendingTimer = setTimeout(
      flush,
      Math.max(0, getDeferredMarkdownSerializeDelayMs(doc, delayMs))
    );
  };

  const destroy = () => {
    destroyed = true;
    clearPendingTimer();
    pendingDoc = null;
  };

  return {
    destroy,
    flush,
    schedule,
  };
}

export function createDeferredMarkdownUpdatePlugin(
  ctx: Ctx,
  onMarkdownUpdated: (markdown: string) => void,
  options: {
    shouldSerialize?: () => boolean;
  } = {},
) {
  return new Plugin({
    view() {
      const controller = createDeferredMarkdownUpdateController({
        onMarkdownUpdated,
        serializeDoc: (doc) => ctx.get(serializerCtx)(doc),
        shouldSerialize: options.shouldSerialize,
      });

      return {
        update(view: EditorView, prevState) {
          if (prevState?.doc.eq(view.state.doc)) {
            return;
          }
          controller.schedule(view.state.doc);
        },
        destroy() {
          controller.flush();
          controller.destroy();
        },
      };
    },
  });
}
