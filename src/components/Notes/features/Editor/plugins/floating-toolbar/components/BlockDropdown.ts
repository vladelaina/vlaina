// Block Type Dropdown Component
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType, FloatingToolbarState } from '../types';
import { BLOCK_TYPES } from '../utils';
import { convertBlockType } from '../commands';

// Block type icons as SVG strings
const BLOCK_ICONS: Record<string, string> = {
  text: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
  </svg>`,
  h1: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 12h8M4 18V6M12 18V6M17 12l3-2v8"/>
  </svg>`,
  h2: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>
  </svg>`,
  h3: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 12h8M4 18V6M12 18V6M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2M17.5 13.5c1.7 1 3.5 0 3.5-1.5a2 2 0 0 0-2-2"/>
  </svg>`,
  h4: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 12h8M4 18V6M12 18V6M17 10v4h4M21 10v8"/>
  </svg>`,
  h5: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 12h8M4 18V6M12 18V6M17 18h4c0-4-4-3-4-6h4"/>
  </svg>`,
  h6: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 12h8M4 18V6M12 18V6M19.5 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M19.5 10c-1.5 0-2.5 1-2.5 2.5"/>
  </svg>`,
  quote: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21"/>
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3"/>
  </svg>`,
  list: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>
  </svg>`,
  listOrdered: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
    <path d="M4 6h1v4M3 10h3M4 14.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 0-.5.5v.5a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5"/>
  </svg>`,
  listCheck: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3.5 5.5L5 7l2.5-2.5M3.5 11.5L5 13l2.5-2.5M3.5 17.5L5 19l2.5-2.5"/>
    <line x1="11" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="11" y1="18" x2="21" y2="18"/>
  </svg>`,
  code: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>`,
};

/**
 * Render block type dropdown
 */
export function renderBlockDropdown(
  container: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState,
  onClose: () => void
): void {
  const dropdown = document.createElement('div');
  dropdown.className = 'toolbar-submenu block-dropdown';
  
  let html = '';
  
  BLOCK_TYPES.forEach((config) => {
    const isActive = state.currentBlockType === config.type;
    const icon = BLOCK_ICONS[config.icon] || BLOCK_ICONS.text;
    
    html += `
      <button class="block-dropdown-item ${isActive ? 'active' : ''}" data-block-type="${config.type}">
        <span class="block-dropdown-item-icon">${icon}</span>
        <span>${config.label}</span>
        ${config.shortcut ? `<span class="block-dropdown-item-shortcut">${config.shortcut}</span>` : ''}
      </button>
    `;
  });
  
  dropdown.innerHTML = html;
  
  // Append first to measure size
  container.appendChild(dropdown);
  
  // Smart positioning: check if dropdown would overflow viewport or cover content
  requestAnimationFrame(() => {
    const dropdownRect = dropdown.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const toolbarRect = container.closest('.floating-toolbar')?.getBoundingClientRect();
    
    if (toolbarRect) {
      // Check if dropdown extends beyond viewport bottom
      const spaceBelow = viewportHeight - toolbarRect.bottom - 16; // 16px margin
      const spaceAbove = toolbarRect.top - 16;
      const dropdownHeight = dropdownRect.height;
      
      // If not enough space below but enough above, show above
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        dropdown.classList.add('dropdown-above');
        // Set max-height based on available space above
        const maxHeight = Math.min(spaceAbove, dropdownHeight);
        dropdown.style.maxHeight = `${maxHeight}px`;
      } else {
        dropdown.classList.remove('dropdown-above');
        // Set max-height based on available space below
        const maxHeight = Math.min(spaceBelow, dropdownHeight);
        dropdown.style.maxHeight = `${maxHeight}px`;
      }
    }
  });
  
  // Add event listeners
  dropdown.querySelectorAll('[data-block-type]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const blockType = (btn as HTMLElement).dataset.blockType as BlockType;
      convertBlockType(view, blockType);
      onClose();
    });
  });
}

/**
 * Get block type display label
 */
export function getBlockTypeDisplayLabel(blockType: BlockType): string {
  const config = BLOCK_TYPES.find(b => b.type === blockType);
  return config?.label || 'Text';
}

/**
 * Get short label for toolbar button
 */
export function getBlockTypeShortLabel(blockType: BlockType): string {
  const shortLabels: Record<BlockType, string> = {
    paragraph: 'Text',
    heading1: 'H1',
    heading2: 'H2',
    heading3: 'H3',
    heading4: 'H4',
    heading5: 'H5',
    heading6: 'H6',
    blockquote: 'Quote',
    bulletList: 'Bullet',
    orderedList: 'Number',
    taskList: 'Task',
    codeBlock: 'Code',
  };
  return shortLabels[blockType] || 'Text';
}
