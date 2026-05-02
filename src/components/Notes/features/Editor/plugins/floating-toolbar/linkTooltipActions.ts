import type { EditorView } from '@milkdown/kit/prose/view';
import { linkTooltipPluginKey } from '../links';
import { floatingToolbarKey } from './floatingToolbarKey';
import { TOOLBAR_ACTIONS } from './types';

export function openLinkTooltipFromSelection(
  view: EditorView,
  options?: { autoFocus?: boolean }
) {
  const { from, to } = view.state.selection;
  const tr = view.state.tr
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
  view.focus();
}
