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
  // .milkdown u
  underline: { textDecoration: 'underline' },
  // .milkdown del
  strike: { textDecoration: 'line-through' },
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
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const nodeRange = document.createRange();
        nodeRange.selectNode(node);
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
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
 * Apply format preview to selected text
 */
export function applyFormatPreview(view: EditorView, action: string): void {
  const styles = FORMAT_PREVIEW_STYLES[action];
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
      const processedParents = new Set<HTMLElement>();
      
      for (const textNode of textNodes) {
        // Get the immediate parent of the text node
        const parent = textNode.parentElement;
        if (!parent || processedParents.has(parent)) continue;
        
        // Skip editor root elements
        if (parent.classList?.contains('milkdown') || parent.classList?.contains('ProseMirror')) {
          continue;
        }
        
        processedParents.add(parent);
        
        // Save original styles
        const originalStyles: Record<string, string> = {};
        Object.keys(styles).forEach(key => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          originalStyles[key] = parent.style.getPropertyValue(cssKey);
        });
        
        formatPreviewNodes.push({ node: parent, originalStyles });
        
        // Apply preview styles with !important
        Object.entries(styles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          parent.style.setProperty(cssKey, value, 'important');
        });
      }
    } catch {
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
        
        Object.entries(originalStyles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          if (value) {
            node.style.setProperty(cssKey, value);
          } else {
            node.style.removeProperty(cssKey);
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
