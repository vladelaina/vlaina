import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState, TextAlignment } from '../types';
import { setTextAlignment } from '../commands';
import { applyAlignmentPreview, clearFormatPreview, commitAlignmentPreview } from '../previewStyles';
import { collapseSelectionAfterToolbarApply } from '../selectionCollapse';
import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { translate, type MessageKey } from '@/lib/i18n';
import { escapeToolbarHtml } from '../htmlEscape';

const ALIGNMENT_ITEMS: Array<{
  type: TextAlignment;
  labelKey: MessageKey;
  icon: string;
}> = [
  { type: 'left', labelKey: 'editor.textAlignment.left', icon: EDITOR_ICONS.alignLeft },
  { type: 'center', labelKey: 'editor.textAlignment.center', icon: EDITOR_ICONS.alignCenter },
  { type: 'right', labelKey: 'editor.textAlignment.right', icon: EDITOR_ICONS.alignRight },
];

export function renderAlignmentDropdown(
  container: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState,
  onClose: () => void
): void {
  const dropdown = document.createElement('div');
  dropdown.className = `toolbar-submenu alignment-dropdown !rounded-[var(--vlaina-radius-26px)] ${chatComposerPillSurfaceClass}`;

  dropdown.innerHTML = ALIGNMENT_ITEMS.map((item) => {
    const isActive = state.currentAlignment === item.type;

    return `
      <button
        class="block-dropdown-item ${isActive ? 'active' : ''}"
        data-alignment="${item.type}"
        aria-label="${escapeToolbarHtml(translate(item.labelKey))}"
      >
        <span class="block-dropdown-item-icon">${item.icon}</span>
      </button>
    `;
  }).join('');

  container.appendChild(dropdown);

  dropdown.querySelectorAll<HTMLElement>('[data-alignment]').forEach((button) => {
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    button.addEventListener('mouseenter', () => {
      const alignment = button.dataset.alignment as TextAlignment;
      applyAlignmentPreview(view, alignment);
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const alignment = button.dataset.alignment as TextAlignment;
      let committedPreview = false;
      try {
        committedPreview = commitAlignmentPreview(view, alignment);
        if (!committedPreview) {
          setTextAlignment(view, alignment);
        }
      } finally {
        clearFormatPreview(view);
        if (!committedPreview) {
          view.focus();
        }
      }
      onClose();
      collapseSelectionAfterToolbarApply(view);
    });
  });

  dropdown.addEventListener('mouseleave', () => {
    clearFormatPreview(view);
  });
}
