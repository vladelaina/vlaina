// Block Type Dropdown Component
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType, FloatingToolbarState } from '../types';
import { BLOCK_TYPES } from '../utils';
import { convertBlockType } from '../commands';
import { getCurrentBlockElement } from '../floatingToolbarPlugin';

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
      const spaceBelow = viewportHeight - toolbarRect.bottom;
      const spaceAbove = toolbarRect.top;
      const dropdownHeight = dropdownRect.height + 8; // 8px margin
      
      // If not enough space below but enough above, show above
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        dropdown.classList.add('dropdown-above');
      } else {
        dropdown.classList.remove('dropdown-above');
      }
    }
  });
  
  // Function to find the current block element (called fresh each time)
  const findCurrentBlockElement = (): HTMLElement | null => {
    // Get from the plugin's saved reference, but verify it's still in DOM
    const saved = getCurrentBlockElement();
    if (saved && document.body.contains(saved)) {
      return saved;
    }
    
    // Fallback: find by selection
    try {
      const { $from } = view.state.selection;
      const domAtPos = view.domAtPos($from.pos);
      let node = domAtPos.node as Node;
      
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode as Node;
      }
      
      let el = node as HTMLElement;
      while (el && el.parentElement) {
        const tagName = el.tagName?.toUpperCase();
        if (tagName === 'P' || (tagName && /^H[1-6]$/.test(tagName))) {
          return el;
        }
        if (el.classList?.contains('milkdown') || el.classList?.contains('editor')) {
          break;
        }
        el = el.parentElement;
      }
    } catch {
      // ignore
    }
    return null;
  };
  
  // Preview styles for each heading level
  const PREVIEW_STYLES: Record<number, Partial<CSSStyleDeclaration>> = {
    1: { fontSize: '2rem', fontWeight: '700', lineHeight: '1.2' },
    2: { fontSize: '1.5rem', fontWeight: '600', lineHeight: '1.3' },
    3: { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.4' },
    4: { fontSize: '1rem', fontWeight: '600', lineHeight: '1.5' },
    5: { fontSize: '0.875rem', fontWeight: '600', lineHeight: '1.5', textTransform: 'uppercase' },
    6: { fontSize: '0.85rem', fontWeight: '600', lineHeight: '1.5', textDecoration: 'underline' },
  };
  
  // Track which element we're currently previewing on
  let previewingElement: HTMLElement | null = null;
  let originalStyles: Record<string, string> = {};
  
  // Helper to apply preview styles
  const applyPreviewStyle = (level: number) => {
    const blockNode = findCurrentBlockElement();
    if (!blockNode) return;
    
    // Clear previous preview if on different element
    if (previewingElement && previewingElement !== blockNode) {
      clearPreview();
    }
    
    // Save original styles if not already saved
    if (previewingElement !== blockNode) {
      previewingElement = blockNode;
      originalStyles = {
        fontSize: blockNode.style.fontSize,
        fontWeight: blockNode.style.fontWeight,
        lineHeight: blockNode.style.lineHeight,
        textTransform: blockNode.style.textTransform,
        textDecoration: blockNode.style.textDecoration,
      };
    }
    
    // Apply preview styles - use setProperty to bypass any observers
    const styles = PREVIEW_STYLES[level];
    if (styles) {
      // Temporarily disable ProseMirror's DOM observer
      const domObserver = (view as any).domObserver;
      if (domObserver) {
        domObserver.stop();
      }
      
      // Reset and apply styles
      blockNode.style.setProperty('text-transform', 'none', 'important');
      blockNode.style.setProperty('text-decoration', 'none', 'important');
      
      if (styles.fontSize) blockNode.style.setProperty('font-size', styles.fontSize, 'important');
      if (styles.fontWeight) blockNode.style.setProperty('font-weight', styles.fontWeight, 'important');
      if (styles.lineHeight) blockNode.style.setProperty('line-height', styles.lineHeight, 'important');
      if (styles.textTransform) blockNode.style.setProperty('text-transform', styles.textTransform, 'important');
      if (styles.textDecoration) blockNode.style.setProperty('text-decoration', styles.textDecoration, 'important');
      
      // Re-enable DOM observer
      if (domObserver) {
        domObserver.start();
      }
    }
  };
  
  // Helper to clear preview styles
  const clearPreview = () => {
    if (previewingElement && document.body.contains(previewingElement)) {
      // Temporarily disable ProseMirror's DOM observer
      const domObserver = (view as any).domObserver;
      if (domObserver) {
        domObserver.stop();
      }
      
      previewingElement.style.removeProperty('font-size');
      previewingElement.style.removeProperty('font-weight');
      previewingElement.style.removeProperty('line-height');
      previewingElement.style.removeProperty('text-transform');
      previewingElement.style.removeProperty('text-decoration');
      
      // Restore original if any
      if (originalStyles.fontSize) previewingElement.style.fontSize = originalStyles.fontSize;
      if (originalStyles.fontWeight) previewingElement.style.fontWeight = originalStyles.fontWeight;
      if (originalStyles.lineHeight) previewingElement.style.lineHeight = originalStyles.lineHeight;
      if (originalStyles.textTransform) previewingElement.style.textTransform = originalStyles.textTransform;
      if (originalStyles.textDecoration) previewingElement.style.textDecoration = originalStyles.textDecoration;
      
      // Re-enable DOM observer
      if (domObserver) {
        domObserver.start();
      }
    }
    previewingElement = null;
    originalStyles = {};
  };
  
  // Add event listeners
  dropdown.querySelectorAll('[data-block-type]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearPreview();
      const blockType = (btn as HTMLElement).dataset.blockType as BlockType;
      convertBlockType(view, blockType);
      onClose();
    });
    
    // Preview on hover (for headings)
    btn.addEventListener('mouseenter', () => {
      const blockType = (btn as HTMLElement).dataset.blockType as BlockType;
      clearPreview();
      if (blockType.startsWith('heading')) {
        const level = parseInt(blockType.replace('heading', ''));
        applyPreviewStyle(level);
      }
    });
    
    btn.addEventListener('mouseleave', () => {
      clearPreview();
    });
  });
}

/**
 * Get block type display label
 */
export function getBlockTypeDisplayLabel(blockType: BlockType): string {
  const config = BLOCK_TYPES.find(b => b.type === blockType);
  return config?.label || '正文';
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
