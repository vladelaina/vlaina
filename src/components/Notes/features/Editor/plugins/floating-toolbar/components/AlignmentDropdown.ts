import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState, TextAlignment } from '../types';
import { setTextAlignment } from '../commands';
import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';

const ALIGNMENT_ITEMS: Array<{
  type: TextAlignment;
  label: string;
  icon: string;
}> = [
  { type: 'left', label: 'Align Left', icon: EDITOR_ICONS.alignLeft },
  { type: 'center', label: 'Align Center', icon: EDITOR_ICONS.alignCenter },
  { type: 'right', label: 'Align Right', icon: EDITOR_ICONS.alignRight },
];

export function renderAlignmentDropdown(
  container: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState,
  onClose: () => void
): void {
  const dropdown = document.createElement('div');
  dropdown.className = 'toolbar-submenu alignment-dropdown';

  dropdown.innerHTML = ALIGNMENT_ITEMS.map((item) => {
    const isActive = state.currentAlignment === item.type;

    return `
      <button class="block-dropdown-item ${isActive ? 'active' : ''}" data-alignment="${item.type}">
        <span class="block-dropdown-item-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>
    `;
  }).join('');

  container.appendChild(dropdown);

  requestAnimationFrame(() => {
    const dropdownRect = dropdown.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const toolbarRect = container.closest('.floating-toolbar')?.getBoundingClientRect();

    if (!toolbarRect) {
      return;
    }

    const spaceBelow = viewportHeight - toolbarRect.bottom - 16;
    const spaceAbove = toolbarRect.top - 16;
    const dropdownHeight = dropdownRect.height;

    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      dropdown.classList.add('dropdown-above');
      dropdown.style.maxHeight = `${Math.min(spaceAbove, dropdownHeight)}px`;
      return;
    }

    dropdown.classList.remove('dropdown-above');
    dropdown.style.maxHeight = `${Math.min(spaceBelow, dropdownHeight)}px`;
  });

  dropdown.querySelectorAll<HTMLElement>('[data-alignment]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const alignment = button.dataset.alignment as TextAlignment;
      setTextAlignment(view, alignment);
      onClose();
    });
  });
}
