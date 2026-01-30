// Color Picker Component
import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from '../types';
import { COLOR_PALETTE, COLOR_PALETTE_DARK } from '../utils';
import { setTextColor, setBgColor } from '../commands';

/**
 * Render color picker submenu
 */
export function renderColorPicker(
  container: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState,
  onClose: () => void
): void {
  const picker = document.createElement('div');
  picker.className = 'toolbar-submenu color-picker';
  
  // Detect dark mode
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
            title="${color.label}"
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
            title="${color.label}"
            style="${color.bgColor ? `background-color: ${color.bgColor}` : ''}"
          ></button>
        `).join('')}
      </div>
    </div>
  `;
  
  // Handle text color clicks
  picker.querySelector('[data-type="text"]')?.querySelectorAll('.color-picker-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const colorId = (btn as HTMLElement).dataset.colorId;
      const color = colorId === 'default' ? null : (btn as HTMLElement).dataset.color || null;
      setTextColor(view, color);
      onClose();
    });
  });
  
  // Handle background color clicks
  picker.querySelector('[data-type="bg"]')?.querySelectorAll('.color-picker-item').forEach((btn) => {
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

/**
 * Get color indicator style for toolbar button
 */
export function getColorIndicatorStyle(textColor: string | null, bgColor: string | null): string {
  if (textColor) {
    return `background-color: ${textColor}`;
  }
  if (bgColor) {
    return `background-color: ${bgColor}`;
  }
  return '';
}