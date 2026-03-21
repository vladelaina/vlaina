import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from '../types';
import { COLOR_PALETTE, COLOR_PALETTE_DARK } from '../utils';
import { setTextColor, setBgColor } from '../commands';

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
            class="color-picker-item ${color.id === 'default' ? 'color-picker-item-default' : ''} ${state.bgColor === color.bgColor ? 'active' : ''}"
            data-color-id="${color.id}"
            data-color="${color.bgColor || ''}"
            style="${color.bgColor ? `background-color: ${color.bgColor}` : ''}"
          ></button>
        `).join('')}
      </div>
    </div>
  `;

  picker.querySelector('[data-type="text"]')?.querySelectorAll('.color-picker-item').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const colorId = (btn as HTMLElement).dataset.colorId;
      const color = colorId === 'default' ? null : (btn as HTMLElement).dataset.color || null;
      setTextColor(view, color);
      onClose();
    });
  });

  picker.querySelector('[data-type="bg"]')?.querySelectorAll('.color-picker-item').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const colorId = (btn as HTMLElement).dataset.colorId;
      const color = colorId === 'default' ? null : (btn as HTMLElement).dataset.color || null;
      setBgColor(view, color);
      onClose();
    });
  });
  
  container.appendChild(picker);
}

export function getColorIndicatorStyle(textColor: string | null, bgColor: string | null): string {
  if (textColor) {
    return `background-color: ${textColor}`;
  }
  if (bgColor) {
    return `background-color: ${bgColor}`;
  }
  return '';
}
