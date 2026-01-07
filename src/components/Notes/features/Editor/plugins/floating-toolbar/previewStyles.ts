// Preview Styles Module
// Handles real-time preview for format and block type changes

import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType } from './types';

// Format preview styles mapping - matching editor.css exactly
export const FORMAT_PREVIEW_STYLES: Record<string, Record<string, string>> = {
  // .milkdown strong
  bold: { fontWeight: '600' },
  // .milkdown em
  italic: { fontStyle: 'italic' },
  // .milkdown u - use textDecorationLine to avoid conflicts
  underline: { textDecorationLine: 'underline' },
  // .milkdown del - use textDecorationLine to avoid conflicts
  strike: { textDecorationLine: 'line-through' },
  // .milkdown code
  code: { 
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: '0.875em',
    backgroundColor: 'var(--neko-bg-tertiary)',
    color: '#be185d',
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
  },
  // .milkdown mark.highlight
  highlight: { 
    backgroundColor: '#fef08a',
    padding: '0.125rem 0.25rem',
    borderRadius: '0.125rem',
  },
};

// Block type preview styles - matching editor.css exactly
export const BLOCK_PREVIEW_STYLES: Record<BlockType, Record<string, string>> = {
  // Paragraph: .milkdown p
  paragraph: { 
    fontSize: '1rem', 
    fontWeight: '400', 
    lineHeight: '1.75',
    fontStyle: 'normal',
    textTransform: 'none',
    textDecoration: 'none',
    letterSpacing: 'normal',
    borderLeft: 'none',
    paddingLeft: '0',
    padding: '0',
    backgroundColor: 'transparent',
  },
  // H1: .milkdown h1
  heading1: { 
    fontSize: '2rem', 
    fontWeight: '700', 
    lineHeight: '1.2',
    textTransform: 'none',
    textDecoration: 'none',
    letterSpacing: 'normal',
  },
  // H2: .milkdown h2
  heading2: { 
    fontSize: '1.5rem', 
    fontWeight: '600', 
    lineHeight: '1.3',
    textTransform: 'none',
    textDecoration: 'none',
    letterSpacing: 'normal',
  },
  // H3: .milkdown h3
  heading3: { 
    fontSize: '1.25rem', 
    fontWeight: '600', 
    lineHeight: '1.4',
    textTransform: 'none',
    textDecoration: 'none',
    letterSpacing: 'normal',
  },
  // H4: .milkdown h4
  heading4: { 
    fontSize: '1rem', 
    fontWeight: '600', 
    lineHeight: '1.5',
    textTransform: 'none',
    textDecoration: 'none',
    letterSpacing: 'normal',
  },
  // H5: .milkdown h5
  heading5: { 
    fontSize: '0.875rem', 
    fontWeight: '600', 
    lineHeight: '1.5', 
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textDecoration: 'none',
  },
  // H6: .milkdown h6
  heading6: { 
    fontSize: '0.85rem', 
    fontWeight: '600', 
    lineHeight: '1.5', 
    textDecoration: 'underline',
    textTransform: 'none',
    letterSpacing: 'normal',
  },
  // Blockquote: .milkdown blockquote
  blockquote: { 
    fontStyle: 'italic', 
    borderLeft: '4px solid var(--neko-accent)',
    backgroundColor: 'var(--neko-accent-light)',
    padding: '0.75rem 1rem',
    borderRadius: '0 0.5rem 0.5rem 0',
  },
  // Lists use margin-left in CSS
  bulletList: { marginLeft: '1.5rem' },
  orderedList: { marginLeft: '1.5rem' },
  taskList: { marginLeft: '0' },
  // Code block: .milkdown pre
  codeBlock: { 
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    backgroundColor: '#18181b',
    padding: '1rem 1.25rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    lineHeight: '1.7',
  },
};

// Track format preview state
let formatPreviewNodes: { node: HTMLElement; originalStyles: Record<string, string> }[] = [];

// Track block preview state
let blockPreviewElement: HTMLElement | null = null;
let blockOriginalStyles: Record<string, string> = {};

// All style keys we might modify for block preview
const BLOCK_STYLE_KEYS = [
  'fontSize', 'fontWeight', 'lineHeight', 'fontStyle', 'fontFamily',
  'textTransform', 'textDecoration', 'letterSpacing',
  'borderLeft', 'paddingLeft', 'padding', 'marginLeft',
  'color', 'backgroundColor', 'borderRadius',
];

/**
 * Temporarily disable ProseMirror's DOM observer
 */
function withDomObserverPaused<T>(view: EditorView, fn: () => T): T {
  const domObserver = (view as any).domObserver;
  if (domObserver) {
    domObserver.stop();
  }
  try {
    return fn();
  } finally {
    if (domObserver) {
      domObserver.start();
    }
  }
}

/**
 * Get all text nodes within a range
 */
function getTextNodesInRange(range: Range): Text[] {
  const textNodes: Text[] = [];
  
  // Handle case where selection is within a single text node
  if (range.startContainer.nodeType === Node.TEXT_NODE && 
      range.startContainer === range.endContainer) {
    textNodes.push(range.startContainer as Text);
    return textNodes;
  }
  
  // Get the common ancestor - handle text node case
  let ancestor = range.commonAncestorContainer;
  if (ancestor.nodeType === Node.TEXT_NODE) {
    ancestor = ancestor.parentElement!;
  }
  
  if (!ancestor) return textNodes;
  
  const walker = document.createTreeWalker(
    ancestor,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Check if this text node is within the selection range
        if (!range.intersectsNode(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        // Accept all text nodes including whitespace (they might be part of selection)
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }
  
  return textNodes;
}

/**
 * Find the closest inline element that should receive the style
 * Returns the most specific inline element containing the text
 */
function getStyleTarget(textNode: Text): HTMLElement | null {
  const parent = textNode.parentElement;
  if (!parent) return null;
  
  // Skip editor root elements
  if (parent.classList?.contains('milkdown') || 
      parent.classList?.contains('ProseMirror') ||
      parent.classList?.contains('editor')) {
    return null;
  }
  
  const tagName = parent.tagName?.toUpperCase();
  
  // For inline elements (span, strong, em, mark, code, etc.), use them directly
  const inlineTags = ['SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'DEL', 'MARK', 'CODE', 'A', 'SUB', 'SUP'];
  if (inlineTags.includes(tagName || '')) {
    return parent;
  }
  
  // For block elements (p, h1-h6, li, etc.), we still apply to them
  // This is a limitation - we can't wrap partial text without modifying DOM
  // But it's better than nothing for preview purposes
  if (tagName === 'P' || tagName === 'DIV' || /^H[1-6]$/.test(tagName || '') ||
      tagName === 'LI' || tagName === 'BLOCKQUOTE' || tagName === 'TD' || tagName === 'TH') {
    return parent;
  }
  
  // For other elements, try parent
  return parent;
}

// Default/reset styles for removing format preview
const FORMAT_RESET_STYLES: Record<string, Record<string, string>> = {
  bold: { fontWeight: 'normal' },
  italic: { fontStyle: 'normal' },
  // For text-decoration, we need to handle it specially since multiple decorations can coexist
  underline: { textDecorationLine: 'none' },
  strike: { textDecorationLine: 'none' },
  code: { 
    fontFamily: 'inherit',
    fontSize: 'inherit',
    backgroundColor: 'transparent',
    color: 'inherit',
    padding: '0',
    borderRadius: '0',
  },
  highlight: { 
    backgroundColor: 'transparent',
    padding: '0',
    borderRadius: '0',
  },
};

// All format style keys we might modify (for complete cleanup)
const ALL_FORMAT_STYLE_KEYS = [
  'fontWeight', 'fontStyle', 'textDecoration', 'textDecorationLine',
  'fontFamily', 'fontSize', 'backgroundColor', 'color', 'padding', 'borderRadius'
];

/**
 * Apply format preview to selected text
 * @param isActive - If true, preview removing the format (for already active formats)
 */
export function applyFormatPreview(view: EditorView, action: string, isActive: boolean = false): void {
  // Use reset styles if format is active (preview removal), otherwise use format styles
  const styles = isActive ? FORMAT_RESET_STYLES[action] : FORMAT_PREVIEW_STYLES[action];
  if (!styles) return;
  
  clearFormatPreview(view);
  
  const { selection } = view.state;
  if (selection.empty) return;
  
  const domSelection = window.getSelection();
  if (!domSelection || domSelection.rangeCount === 0) return;
  
  const range = domSelection.getRangeAt(0);
  if (range.collapsed) return;
  
  withDomObserverPaused(view, () => {
    try {
      const textNodes = getTextNodesInRange(range);
      const processedElements = new Set<HTMLElement>();
      
      for (const textNode of textNodes) {
        // Get the appropriate element to style
        const target = getStyleTarget(textNode);
        if (!target || processedElements.has(target)) continue;
        
        processedElements.add(target);
        
        // Save ALL format-related original styles (not just the ones we're changing)
        // This ensures complete restoration
        const originalStyles: Record<string, string> = {};
        ALL_FORMAT_STYLE_KEYS.forEach(key => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          originalStyles[key] = target.style.getPropertyValue(cssKey);
        });
        
        formatPreviewNodes.push({ node: target, originalStyles });
        
        // Apply preview styles with !important
        Object.entries(styles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          target.style.setProperty(cssKey, value, 'important');
        });
      }
    } catch (e) {
      console.warn('Format preview failed:', e);
      formatPreviewNodes = [];
    }
  });
}

/**
 * Clear format preview
 */
export function clearFormatPreview(view: EditorView): void {
  if (formatPreviewNodes.length === 0) return;
  
  withDomObserverPaused(view, () => {
    try {
      for (const { node, originalStyles } of formatPreviewNodes) {
        if (!document.body.contains(node)) continue;
        
        // First, remove all format-related styles we might have set
        ALL_FORMAT_STYLE_KEYS.forEach(key => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          node.style.removeProperty(cssKey);
        });
        
        // Then restore original styles
        Object.entries(originalStyles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          if (value) {
            node.style.setProperty(cssKey, value);
          }
        });
      }
    } catch {
      // Cleanup might fail, that's ok
    }
    formatPreviewNodes = [];
  });
}

/**
 * Apply block type preview to a block element
 */
export function applyBlockPreview(view: EditorView, blockElement: HTMLElement, blockType: BlockType): void {
  const styles = BLOCK_PREVIEW_STYLES[blockType];
  if (!styles || !blockElement) return;
  
  // Clear previous preview if on different element
  if (blockPreviewElement && blockPreviewElement !== blockElement) {
    clearBlockPreview(view);
  }
  
  // Save original styles if not already saved
  if (blockPreviewElement !== blockElement) {
    blockPreviewElement = blockElement;
    blockOriginalStyles = {};
    BLOCK_STYLE_KEYS.forEach(key => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      blockOriginalStyles[key] = blockElement.style.getPropertyValue(cssKey);
    });
  }
  
  withDomObserverPaused(view, () => {
    // Reset common styles first
    BLOCK_STYLE_KEYS.forEach(key => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      blockElement.style.removeProperty(cssKey);
    });
    
    // Apply preview styles
    Object.entries(styles).forEach(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      blockElement.style.setProperty(cssKey, value, 'important');
    });
  });
}

/**
 * Clear block preview
 */
export function clearBlockPreview(view: EditorView): void {
  if (!blockPreviewElement || !document.body.contains(blockPreviewElement)) {
    blockPreviewElement = null;
    blockOriginalStyles = {};
    return;
  }
  
  withDomObserverPaused(view, () => {
    const el = blockPreviewElement!;
    
    // Remove all preview styles
    BLOCK_STYLE_KEYS.forEach(key => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      el.style.removeProperty(cssKey);
    });
    
    // Restore original styles
    Object.entries(blockOriginalStyles).forEach(([key, value]) => {
      if (value) {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        el.style.setProperty(cssKey, value);
      }
    });
  });
  
  blockPreviewElement = null;
  blockOriginalStyles = {};
}

// Legacy aliases for backward compatibility
export const applyHeadingPreview = (view: EditorView, blockElement: HTMLElement, level: number) => {
  const blockType = `heading${level}` as BlockType;
  applyBlockPreview(view, blockElement, blockType);
};

export const clearHeadingPreview = clearBlockPreview;

/**
 * Check if an action supports format preview
 */
export function hasFormatPreview(action: string): boolean {
  return action in FORMAT_PREVIEW_STYLES;
}
