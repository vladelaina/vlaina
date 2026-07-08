import type { EditorView } from '@milkdown/kit/prose/view';
import { translate } from '@/lib/i18n';
import type { FloatingToolbarState } from '../types';
import { setLink } from '../commands';
import { collapseSelectionAfterToolbarApply } from '../selectionCollapse';
import { isValidUrl } from '../utils';
import { renderUrlRailEditor } from './UrlRailEditor';

export function renderLinkEditor(
  container: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState,
  onClose: () => void
): void {
  const currentUrl = state.linkUrl || '';
  const shouldAutofocus = Boolean(state.linkUrl);

  renderUrlRailEditor(container, {
    value: currentUrl,
    placeholder: translate('editor.linkPlaceholder'),
    hint: translate('editor.linkUrlHint'),
    autoFocus: shouldAutofocus,
    validate: isValidUrl,
    onEmpty() {
      setLink(view, null);
      onClose();
      collapseSelectionAfterToolbarApply(view);
    },
    onSubmit(value) {
      setLink(view, value);
      onClose();
      collapseSelectionAfterToolbarApply(view);
    },
    onCancel: onClose,
  });
}
