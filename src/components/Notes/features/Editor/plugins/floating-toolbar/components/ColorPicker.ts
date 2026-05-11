import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from '../types';
import { COLOR_PALETTE, COLOR_PALETTE_DARK } from '../utils';
import { setTextColor, setBgColor } from '../commands';
import { collapseSelectionAfterToolbarApply } from '../selectionCollapse';
import {
  applyColorPickerIdlePreview,
  applyBgColorPreview,
  applyTextColorPreview,
  clearFormatPreview,
  commitBgColorPreview,
  commitTextColorPreview,
} from '../previewStyles';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { translate } from '@/lib/i18n';

export function renderColorPicker(
  container: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState,
  onClose: () => void
): void {
  const picker = document.createElement('div');
  picker.className = `toolbar-submenu color-picker !rounded-[26px] ${chatComposerPillSurfaceClass}`;

  const isDark = document.documentElement.classList.contains('dark');
  const palette = isDark ? COLOR_PALETTE_DARK : COLOR_PALETTE;
  const defaultColor = palette.find(color => color.id === 'default');
  const colors = palette.filter(color => color.id !== 'default');
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
      <div class="color-picker-label">${translate('editor.textColor')}</div>
      <div data-type="text">
        ${defaultColor ? `
          <button 
            class="color-picker-item color-picker-item-default ${state.textColor === null ? 'active' : ''}"
            data-color-id="${defaultColor.id}"
            data-color=""
          ></button>
        ` : ''}
        <div class="color-picker-grid">
          ${colors.map(color => `
            <button 
              class="color-picker-item ${state.textColor === color.textColor ? 'active' : ''}"
              data-color-id="${color.id}"
              data-color="${color.textColor || ''}"
              style="${color.textColor ? `background-color: ${color.textColor}` : ''}"
            ></button>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="color-picker-section">
      <div class="color-picker-label">${translate('editor.backgroundColor')}</div>
      <div data-type="bg">
        ${defaultColor ? `
          <button 
            class="color-picker-item color-picker-item-default ${!state.textColor && state.bgColor === null ? 'active' : ''}"
            data-color-id="${defaultColor.id}"
            data-color=""
          ></button>
        ` : ''}
        <div class="color-picker-grid">
          ${colors.map(color => `
            <button 
              class="color-picker-item ${!state.textColor && state.bgColor === color.bgColor ? 'active' : ''}"
              data-color-id="${color.id}"
              data-color="${color.bgColor || ''}"
              style="${color.bgColor ? `background-color: ${color.bgColor}` : ''}"
            ></button>
          `).join('')}
        </div>
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
      collapseSelectionAfterToolbarApply(view);
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
      collapseSelectionAfterToolbarApply(view);
    });
  });

  picker.addEventListener('mouseleave', () => {
    clearFormatPreview(view);
  });
  
  container.appendChild(picker);
}
