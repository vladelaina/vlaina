// Preview Styles Module
// Handles real-time preview for format and block type changes

import type { EditorView } from '@milkdown/kit/prose/view';

// Format preview styles mapping
export const FORMAT_PREVIEW_STYLES: Record<string, Record<string, string>> = {
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  underline: { textDecoration: 'underline' },
  strike: { textDecoration: 'line-through' },
  code: { 
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    backgroundColor: 'rgba(135, 131, 120, 0.15)',
    fontSize: '85%'
  },
  highlight: { backgroundColor: 'rgba(255, 212, 0, 0.4)' },
};

// Heading preview styles
export const HEADING_PREVIEW_STYLES: Record<number, Record<string, string>> = {
  1: { fontSize: '2rem', fontWeight: '700', lineHeight: '1.2' },
  2: { fontSize: '1.5rem', fontWeight: '600', lineHeight: '1.3' },
  3: { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.4' },
  4: { fontSize: '1rem', fontWeight: '600', lineHeight: '1.5' },
  5: { fontSize: '0.875rem', fontWeight: '600', lineHeight: '1.5', textTransform: 'uppercase' },
  6: { fontSize: '0.85rem', fontWeight: '600', lineHeight: '1.5', textDecoration: 'underline' },
};

// Track format preview state
let formatPreviewNodes: { node: HTMLElement; originalStyles: Record<string, string> }[] = [];

// Track heading preview state
let headingPreviewElement: HTMLElement | null = null;
let headingOriginalStyles: Record<string, string> = {};

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
        const parent = textNode.parentElement;
        if (!parent || processedParents.has(parent)) continue;
        
        if (parent.classList?.contains('milkdown') || parent.classList?.contains('ProseMirror')) {
          continue;
        }
        
        processedParents.add(parent);
        
        const originalStyles: Record<string, string> = {};
        Object.keys(styles).forEach(key => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          originalStyles[key] = parent.style.getPropertyValue(cssKey);
        });
        
        formatPreviewNodes.push({ node: parent, originalStyles });
        
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
 * Apply heading preview to a block element
 */
export function applyHeadingPreview(view: EditorView, blockElement: HTMLElement, level: number): void {
  const styles = HEADING_PREVIEW_STYLES[level];
  if (!styles || !blockElement) return;
  
  // Clear previous preview if on different element
  if (headingPreviewElement && headingPreviewElement !== blockElement) {
    clearHeadingPreview(view);
  }
  
  // Save original styles if not already saved
  if (headingPreviewElement !== blockElement) {
    headingPreviewElement = blockElement;
    headingOriginalStyles = {
      fontSize: blockElement.style.fontSize,
      fontWeight: blockElement.style.fontWeight,
      lineHeight: blockElement.style.lineHeight,
      textTransform: blockElement.style.textTransform,
      textDecoration: blockElement.style.textDecoration,
    };
  }
  
  withDomObserverPaused(view, () => {
    // Reset and apply styles
    blockElement.style.setProperty('text-transform', 'none', 'important');
    blockElement.style.setProperty('text-decoration', 'none', 'important');
    
    Object.entries(styles).forEach(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      blockElement.style.setProperty(cssKey, value, 'important');
    });
  });
}

/**
 * Clear heading preview
 */
export function clearHeadingPreview(view: EditorView): void {
  if (!headingPreviewElement || !document.body.contains(headingPreviewElement)) {
    headingPreviewElement = null;
    headingOriginalStyles = {};
    return;
  }
  
  withDomObserverPaused(view, () => {
    const el = headingPreviewElement!;
    
    el.style.removeProperty('font-size');
    el.style.removeProperty('font-weight');
    el.style.removeProperty('line-height');
    el.style.removeProperty('text-transform');
    el.style.removeProperty('text-decoration');
    
    // Restore original if any
    if (headingOriginalStyles.fontSize) el.style.fontSize = headingOriginalStyles.fontSize;
    if (headingOriginalStyles.fontWeight) el.style.fontWeight = headingOriginalStyles.fontWeight;
    if (headingOriginalStyles.lineHeight) el.style.lineHeight = headingOriginalStyles.lineHeight;
    if (headingOriginalStyles.textTransform) el.style.textTransform = headingOriginalStyles.textTransform;
    if (headingOriginalStyles.textDecoration) el.style.textDecoration = headingOriginalStyles.textDecoration;
  });
  
  headingPreviewElement = null;
  headingOriginalStyles = {};
}

/**
 * Check if an action supports format preview
 */
export function hasFormatPreview(action: string): boolean {
  return action in FORMAT_PREVIEW_STYLES;
}
