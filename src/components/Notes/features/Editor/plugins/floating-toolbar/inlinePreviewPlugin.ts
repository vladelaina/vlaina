import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { EditorView } from '@milkdown/kit/prose/view';

type InlinePreviewMeta =
  | {
      type: 'show';
      from: number;
      to: number;
      style: string;
    }
  | {
      type: 'clear';
    };

export const floatingToolbarInlinePreviewKey = new PluginKey<DecorationSet>(
  'floatingToolbarInlinePreview'
);

export const floatingToolbarInlinePreviewPlugin = $prose(() => {
  return new Plugin({
    key: floatingToolbarInlinePreviewKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, oldState) {
        const meta = tr.getMeta(floatingToolbarInlinePreviewKey) as InlinePreviewMeta | undefined;
        if (meta?.type === 'clear') {
          return DecorationSet.empty;
        }

        if (meta?.type === 'show') {
          if (meta.from >= meta.to) {
            return DecorationSet.empty;
          }

          return DecorationSet.create(tr.doc, [
            Decoration.inline(meta.from, meta.to, {
              class: 'floating-toolbar-inline-preview',
              style: meta.style,
            }),
          ]);
        }

        if (tr.selectionSet) {
          return DecorationSet.empty;
        }

        if (tr.docChanged) {
          return (oldState as DecorationSet).map(tr.mapping, tr.doc);
        }

        return oldState;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
});

function toInlineStyleText(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}:${value}`)
    .join(';');
}

export function showInlineFormatPreview(
  view: EditorView,
  from: number,
  to: number,
  styles: Record<string, string>
): void {
  const style = toInlineStyleText(styles);
  view.dispatch(
    view.state.tr
      .setMeta('addToHistory', false)
      .setMeta(floatingToolbarInlinePreviewKey, {
        type: 'show',
        from,
        to,
        style,
      } satisfies InlinePreviewMeta)
  );
}

export function clearInlineFormatPreview(view: EditorView): void {
  view.dispatch(
    view.state.tr
      .setMeta('addToHistory', false)
      .setMeta(floatingToolbarInlinePreviewKey, {
        type: 'clear',
      } satisfies InlinePreviewMeta)
  );
}
