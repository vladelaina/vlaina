import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { hasSelectedBlocks } from '../cursor/blockSelectionPluginState';
import { linkTooltipPluginKey } from '../links';
import { showTextSelectionOverlayForTransaction } from '../selection/textSelectionOverlayPlugin';
import { floatingToolbarKey } from './floatingToolbarKey';
import { TOOLBAR_ACTIONS } from './types';

export function openLinkTooltipFromSelection(
  view: EditorView,
  options?: {
    autoFocus?: boolean;
    selectionRange?: { from: number; to: number } | null;
  }
) {
  if (hasSelectedBlocks(view.state)) {
    return;
  }

  let { from, to } = view.state.selection;
  let tr = view.state.tr;
  const maxPos = view.state.doc.content.size;
  const range = options?.selectionRange;
  if (range && range.from < range.to) {
    const nextFrom = Math.max(0, Math.min(range.from, maxPos));
    const nextTo = Math.max(nextFrom, Math.min(range.to, maxPos));
    if (nextFrom < nextTo) {
      try {
        tr = tr
          .setSelection(TextSelection.create(view.state.doc, nextFrom, nextTo))
          .setMeta('addToHistory', false);
        from = nextFrom;
        to = nextTo;
      } catch {
        // Use the editor's current selection if the stored toolbar range is no longer valid.
      }
    }
  }

  tr = showTextSelectionOverlayForTransaction(tr)
    .setMeta(linkTooltipPluginKey, {
      type: 'SHOW_LINK_TOOLTIP',
      from,
      to,
      autoFocus: options?.autoFocus ?? false,
    })
    .setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.HIDE,
    });

  view.dispatch(tr);
}
