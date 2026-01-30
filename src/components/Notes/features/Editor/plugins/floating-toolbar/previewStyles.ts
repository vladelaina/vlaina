/**
 * Format Preview Module
 * 
 * Provides real-time preview by temporarily applying inline styles to DOM.
 * Reads computed styles from actual rendered elements to ensure consistency.
 */

import type { EditorView } from '@milkdown/kit/prose/view';

// CSS selectors for each format type
const FORMAT_SELECTORS: Record<string, string> = {
  bold: '.milkdown strong',
  italic: '.milkdown em',
  underline: '.milkdown u',
  strike: '.milkdown del, .milkdown s',
  code: '.milkdown code:not(pre code)',
  highlight: '.milkdown mark.highlight, .milkdown mark',
};

// Fallback styles if element doesn't exist in DOM
const FALLBACK_STYLES: Record<string, Record<string, string>> = {
  bold: { fontWeight: '600' },
  italic: { fontStyle: 'italic' },
  underline: { textDecoration: 'underline' },
  strike: { textDecoration: 'line-through' },
  code: { 
    fontFamily: 'inherit',
    fontSize: '13px',
    backgroundColor: 'var(--neko-bg-secondary)',
    border: '1px solid var(--neko-border)',
    borderRadius: '5px',
    padding: '3px 5px',
  },
  highlight: { 
    backgroundColor: '#fef08a',
    padding: '0.125rem 0.25rem',
    borderRadius: '0.125rem',
  },
};

// Style properties to capture for each format
const STYLE_PROPS: Record<string, string[]> = {
  bold: ['fontWeight'],
  italic: ['fontStyle'],
  underline: ['textDecoration', 'textDecorationLine'],
  strike: ['textDecoration', 'textDecorationLine'],
  code: ['fontFamily', 'fontSize', 'backgroundColor', 'border', 'borderRadius', 'padding', 'color'],
  highlight: ['backgroundColor', 'padding', 'borderRadius'],
};

// Cache for computed styles
const styleCache: Record<string, Record<string, string>> = {};

/**
 * Get computed styles for a format by reading from actual DOM element
 */
function getFormatStyles(action: string): Record<string, string> {
  if (styleCache[action]) {
    return styleCache[action];
  }

  const selector = FORMAT_SELECTORS[action];
  if (!selector) return {};

  // Try to find an existing element with this format
  const element = document.querySelector(selector) as HTMLElement;
  
  if (element) {
    const computed = window.getComputedStyle(element);
    const props = STYLE_PROPS[action] || [];
    const styles: Record<string, string> = {};
    
    props.forEach(prop => {
      const value = computed.getPropertyValue(
        prop.replace(/([A-Z])/g, '-$1').toLowerCase()
      );
      if (value) {
        styles[prop] = value;
      }
    });
    
    styleCache[action] = styles;
    return styles;
  }

  // Use fallback if no element found
  return FALLBACK_STYLES[action] || {};
}

// Track preview state
let previewNodes: { node: HTMLElement; originalStyles: Record<string, string> }[] = [];

/**
 * Check if a format action supports preview
 */
export function hasFormatPreview(action: string): boolean {
  return action in FORMAT_SELECTORS;
}

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
  
  if (range.startContainer.nodeType === Node.TEXT_NODE && 
      range.startContainer === range.endContainer) {
    textNodes.push(range.startContainer as Text);
    return textNodes;
  }
  
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
        if (!range.intersectsNode(node)) {
          return NodeFilter.FILTER_REJECT;
        }
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
 * Find the closest inline element for styling
 */
function getStyleTarget(textNode: Text): HTMLElement | null {
  const parent = textNode.parentElement;
  if (!parent) return null;
  
  if (parent.classList?.contains('milkdown') || 
      parent.classList?.contains('ProseMirror') ||
      parent.classList?.contains('editor')) {
    return null;
  }
  
  return parent;
}

/**
 * Apply format preview to selected text
 */
export function applyFormatPreview(
  view: EditorView,
  action: string,
  isActive: boolean = false
): void {
  clearFormatPreview(view);
  
  const { selection } = view.state;
  if (selection.empty) return;
  
  const domSelection = window.getSelection();
  if (!domSelection || domSelection.rangeCount === 0) return;
  
  const range = domSelection.getRangeAt(0);
  if (range.collapsed) return;

  // Get styles - for active formats, we reset; for inactive, we apply
  const styles = isActive 
    ? getResetStyles(action)
    : getFormatStyles(action);
  
  if (Object.keys(styles).length === 0) return;
  
  withDomObserverPaused(view, () => {
    try {
      const textNodes = getTextNodesInRange(range);
      const processedElements = new Set<HTMLElement>();
      
      for (const textNode of textNodes) {
        const target = getStyleTarget(textNode);
        if (!target || processedElements.has(target)) continue;
        
        processedElements.add(target);
        
        // Save original styles
        const originalStyles: Record<string, string> = {};
        Object.keys(styles).forEach(key => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          originalStyles[key] = target.style.getPropertyValue(cssKey);
        });
        
        previewNodes.push({ node: target, originalStyles });
        
        // Apply preview styles
        Object.entries(styles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          target.style.setProperty(cssKey, value, 'important');
        });
      }
    } catch (e) {
      console.warn('Format preview failed:', e);
      previewNodes = [];
    }
  });
}

/**
 * Get reset styles for removing a format preview
 */
function getResetStyles(action: string): Record<string, string> {
  const resets: Record<string, Record<string, string>> = {
    bold: { fontWeight: 'normal' },
    italic: { fontStyle: 'normal' },
    underline: { textDecoration: 'none' },
    strike: { textDecoration: 'none' },
    code: { 
      fontFamily: 'inherit',
      fontSize: 'inherit',
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '0',
      padding: '0',
      color: 'inherit',
    },
    highlight: { 
      backgroundColor: 'transparent',
      padding: '0',
      borderRadius: '0',
    },
  };
  return resets[action] || {};
}

/**
 * Clear format preview
 */
export function clearFormatPreview(view: EditorView): void {
  if (previewNodes.length === 0) return;
  
  withDomObserverPaused(view, () => {
    try {
      for (const { node, originalStyles } of previewNodes) {
        if (!document.body.contains(node)) continue;
        
        // Remove applied styles and restore originals
        Object.entries(originalStyles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          node.style.removeProperty(cssKey);
          if (value) {
            node.style.setProperty(cssKey, value);
          }
        });
      }
    } catch {
      // Cleanup might fail, that's ok
    }
    previewNodes = [];
  });
}