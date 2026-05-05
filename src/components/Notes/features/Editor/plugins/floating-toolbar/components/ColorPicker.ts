import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from '../types';
import { COLOR_PALETTE, COLOR_PALETTE_DARK } from '../utils';
import { setTextColor, setBgColor } from '../commands';
import {
  applyColorPickerIdlePreview,
  applyBgColorPreview,
  applyTextColorPreview,
  clearFormatPreview,
  commitBgColorPreview,
  commitTextColorPreview,
} from '../previewStyles';

function collapseSelectionAfterColorClose(view: EditorView): void {
  const { selection } = view.state;
  if (selection.empty) {
    view.focus();
    return;
  }

  const tr = view.state.tr;
  const clampedPos = Math.max(0, Math.min(selection.to, tr.doc.content.size));

  try {
    tr.setSelection(TextSelection.create(tr.doc, clampedPos));
  } catch {
    tr.setSelection(Selection.near(tr.doc.resolve(clampedPos), -1));
  }

  view.dispatch(tr.setMeta('addToHistory', false));
  view.focus();
}

export function renderColorPicker(
  container: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState,
  onClose: () => void
): void {
  const picker = document.createElement('div');
  picker.className = 'toolbar-submenu color-picker';

  const isDark = document.documentElement.classList.contains('dark');
  const palette = isDark ? COLOR_PALETTE_DARK : COLOR_PALETTE;
  const isSwatchTarget = (target: EventTarget | null) => (
    target instanceof HTMLElement && target.closest('.color-picker-item') !== null
  );
  const applyIdlePreviewFromPanelEvent = (e: Event) => {
    if (isSwatchTarget(e.target)) {
      return;
    }

    applyColorPickerIdlePreview(view);
  };
  
  picker.innerHTML = `
    <div class="color-picker-section">
      <div class="color-picker-label">Text Color</div>
      <div class="color-picker-grid" data-type="text">
        ${palette.map(color => `
          <button 
            class="color-picker-item ${color.id === 'default' ? 'color-picker-item-default' : ''} ${state.textColor === color.textColor ? 'active' : ''}"
            data-color-id="${color.id}"
            data-color="${color.textColor || ''}"
            style="${color.textColor ? `background-color: ${color.textColor}` : ''}"
          ></button>
        `).join('')}
      </div>
    </div>
    <div class="color-picker-section">
      <div class="color-picker-label">Background</div>
      <div class="color-picker-grid" data-type="bg">
        ${palette.map(color => `
          <button 
            class="color-picker-item ${color.id === 'default' ? 'color-picker-item-default' : ''} ${!state.textColor && state.bgColor === color.bgColor ? 'active' : ''}"
            data-color-id="${color.id}"
            data-color="${color.bgColor || ''}"
            style="${color.bgColor ? `background-color: ${color.bgColor}` : ''}"
          ></button>
        `).join('')}
      </div>
    </div>
  `;

  picker.addEventListener('mouseenter', applyIdlePreviewFromPanelEvent);
  picker.addEventListener('mouseover', applyIdlePreviewFromPanelEvent);

  picker.querySelector('[data-type="text"]')?.querySelectorAll('.color-picker-item').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener('mouseenter', () => {
      const colorId = (btn as HTMLElement).dataset.colorId;
      const color = colorId === 'default' ? null : (btn as HTMLElement).dataset.color || null;
      applyTextColorPreview(view, color);
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const colorId = (btn as HTMLElement).dataset.colorId;
      const color = colorId === 'default' ? null : (btn as HTMLElement).dataset.color || null;
      let committedPreview = false;
      try {
        committedPreview = commitTextColorPreview(view, color);
        if (!committedPreview) {
          setTextColor(view, color);
        }
      } finally {
        clearFormatPreview(view);
        view.focus();
      }
      onClose();
      collapseSelectionAfterColorClose(view);
    });
  });

  picker.querySelector('[data-type="bg"]')?.querySelectorAll('.color-picker-item').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener('mouseenter', () => {
      const colorId = (btn as HTMLElement).dataset.colorId;
      const color = colorId === 'default' ? null : (btn as HTMLElement).dataset.color || null;
      applyBgColorPreview(view, color);
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const colorId = (btn as HTMLElement).dataset.colorId;
      const color = colorId === 'default' ? null : (btn as HTMLElement).dataset.color || null;
      let committedPreview = false;
      try {
        committedPreview = commitBgColorPreview(view, color);
        if (!committedPreview) {
          setBgColor(view, color);
        }
      } finally {
        clearFormatPreview(view);
        view.focus();
      }
      onClose();
      collapseSelectionAfterColorClose(view);
    });
  });

  picker.addEventListener('mouseleave', () => {
    clearFormatPreview(view);
  });
  
  container.appendChild(picker);
}
