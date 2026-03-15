import type { EditorView } from '@milkdown/kit/prose/view';
import { TOOLBAR_ACTIONS } from './types';
import { floatingToolbarKey } from './floatingToolbarPlugin';

export function openLinkEditor(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: 'link' },
    })
  );
}

export function openColorPicker(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: 'color' },
    })
  );
}

export function openBlockDropdown(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: 'block' },
    })
  );
}

export function closeSubMenu(view: EditorView): void {
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_SUB_MENU,
      payload: { subMenu: null },
    })
  );
}
