import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType } from './types';
import { clearInlineFormatPreview, showInlineFormatPreview } from './inlinePreviewPlugin';

const FORMAT_SELECTORS: Record<string, string> = {
  bold: '.milkdown strong',
  italic: '.milkdown em',
  underline: '.milkdown u',
  strike: '.milkdown del, .milkdown s',
  code: '.milkdown code:not(pre code)',
  highlight: '.milkdown mark.highlight, .milkdown mark',
};

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

const BLOCK_FALLBACK_STYLES: Partial<Record<BlockType, Record<string, string>>> = {
  paragraph: {
    fontSize: '15px',
    fontWeight: '400',
    lineHeight: 'calc(1em + 8px)',
    letterSpacing: 'normal',
  },
  heading1: {
    fontSize: '28px',
    fontWeight: '700',
    lineHeight: 'calc(1em + 8px)',
    letterSpacing: '-0.02em',
  },
  heading2: {
    fontSize: '26px',
    fontWeight: '600',
    lineHeight: 'calc(1em + 10px)',
    letterSpacing: '-0.02em',
  },
  heading3: {
    fontSize: '24px',
    fontWeight: '600',
    lineHeight: 'calc(1em + 8px)',
    letterSpacing: '-0.02em',
  },
  heading4: {
    fontSize: '22px',
    fontWeight: '600',
    lineHeight: 'calc(1em + 8px)',
    letterSpacing: '-0.015em',
  },
  heading5: {
    fontSize: '20px',
    fontWeight: '600',
    lineHeight: 'calc(1em + 8px)',
    letterSpacing: '-0.015em',
  },
  heading6: {
    fontSize: '18px',
    fontWeight: '600',
    lineHeight: 'calc(1em + 8px)',
    letterSpacing: '-0.015em',
  },
  blockquote: {
    color: 'var(--neko-text-secondary)',
    lineHeight: '26px',
    paddingLeft: '17px',
  },
  codeBlock: {
    fontFamily: 'var(--font-geist-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
    fontSize: '0.875rem',
    lineHeight: '1.7',
    backgroundColor: 'var(--neko-bg-secondary)',
    borderRadius: '0.5rem',
    padding: '0.875rem 1rem',
  },
};

const STYLE_PROPS: Record<string, string[]> = {
  bold: ['fontWeight'],
  italic: ['fontStyle'],
  underline: ['textDecoration', 'textDecorationLine'],
  strike: ['textDecoration', 'textDecorationLine'],
  code: ['fontFamily', 'fontSize', 'backgroundColor', 'border', 'borderRadius', 'padding', 'color'],
  highlight: ['backgroundColor', 'padding', 'borderRadius'],
};

const BLOCK_STYLE_PROPS: Partial<Record<BlockType, string[]>> = {
  paragraph: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  heading1: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  heading2: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  heading3: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  heading4: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  heading5: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  heading6: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  bulletList: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  orderedList: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  taskList: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'],
  blockquote: ['color', 'lineHeight', 'paddingLeft'],
  codeBlock: ['fontFamily', 'fontSize', 'lineHeight', 'backgroundColor', 'borderRadius', 'padding', 'color'],
};

const SCALE_BLOCK_PREVIEW_TYPES = new Set<BlockType>([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'heading5',
  'heading6',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
]);

const styleCache: Record<string, Record<string, string>> = {};
type StylePreviewEntry = {
  kind: 'style';
  node: HTMLElement;
  originalStyles: Record<string, string>;
  originalAttributes: Record<string, string | null>;
};

let previewNodes: StylePreviewEntry[] = [];

export function hasFormatPreview(action: string): boolean {
  return action in FORMAT_SELECTORS;
}

export function hasBlockPreview(blockType: BlockType): boolean {
  return (
    blockType === 'paragraph' ||
    blockType === 'heading1' ||
    blockType === 'heading2' ||
    blockType === 'heading3' ||
    blockType === 'heading4' ||
    blockType === 'heading5' ||
    blockType === 'heading6' ||
    blockType === 'bulletList' ||
    blockType === 'orderedList' ||
    blockType === 'taskList' ||
    blockType === 'blockquote' ||
    blockType === 'codeBlock'
  );
}

function getCssValue(computed: CSSStyleDeclaration, prop: string): string {
  return computed.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
}

function getFormatStyles(action: string): Record<string, string> {
  if (styleCache[action]) {
    return styleCache[action];
  }

  const selector = FORMAT_SELECTORS[action];
  if (!selector) return {};

  const element = document.querySelector(selector) as HTMLElement | null;
  if (element) {
    const computed = window.getComputedStyle(element);
    const props = STYLE_PROPS[action] || [];
    const styles: Record<string, string> = {};

    props.forEach((prop) => {
      const value = getCssValue(computed, prop);
      if (value) {
        styles[prop] = value;
      }
    });

    styleCache[action] = styles;
    return styles;
  }

  return FALLBACK_STYLES[action] || {};
}

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

function getBlockStyles(view: EditorView, blockType: BlockType): Record<string, string> {
  const themeKey = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const sourceType = getBlockStyleSourceType(blockType);
  const cacheKey = `block:${themeKey}:${sourceType}`;
  if (styleCache[cacheKey]) {
    return styleCache[cacheKey];
  }

  const props = BLOCK_STYLE_PROPS[sourceType];
  if (!props || props.length === 0) {
    return {};
  }

  const proseRoot = viewRootForProbe(view);
  if (!proseRoot) {
    return BLOCK_FALLBACK_STYLES[blockType] || {};
  }

  const probeHost = document.createElement('div');
  probeHost.setAttribute('aria-hidden', 'true');
  probeHost.style.position = 'absolute';
  probeHost.style.left = '-99999px';
  probeHost.style.top = '0';
  probeHost.style.visibility = 'hidden';
  probeHost.style.pointerEvents = 'none';
  probeHost.style.contain = 'layout style paint';

  const probe = createBlockProbe(sourceType);
  probeHost.appendChild(probe);
  proseRoot.appendChild(probeHost);

  try {
    const computed = window.getComputedStyle(probe);
    const styles: Record<string, string> = {};

    props.forEach((prop) => {
      const value = getCssValue(computed, prop);
      if (value) {
        styles[prop] = value;
      }
    });

    styleCache[cacheKey] = styles;
    return styles;
  } finally {
    probeHost.remove();
  }
}

function getBlockStyleSourceType(blockType: BlockType): BlockType {
  if (blockType === 'bulletList' || blockType === 'orderedList' || blockType === 'taskList') {
    return 'paragraph';
  }

  return blockType;
}

function viewRootForProbe(view: EditorView): HTMLElement | null {
  if (view.dom instanceof HTMLElement && view.dom.classList.contains('ProseMirror')) {
    return view.dom;
  }

  const proseMirror = view.dom.querySelector('.ProseMirror');
  if (proseMirror instanceof HTMLElement) {
    return proseMirror;
  }

  return view.dom instanceof HTMLElement ? view.dom : null;
}

function createBlockProbe(blockType: BlockType): HTMLElement {
  const withText = (element: HTMLElement) => {
    element.textContent = 'Preview';
    return element;
  };

  switch (blockType) {
    case 'heading1':
      return withText(document.createElement('h1'));
    case 'heading2':
      return withText(document.createElement('h2'));
    case 'heading3':
      return withText(document.createElement('h3'));
    case 'heading4':
      return withText(document.createElement('h4'));
    case 'heading5':
      return withText(document.createElement('h5'));
    case 'heading6':
      return withText(document.createElement('h6'));
    case 'blockquote': {
      const blockquote = document.createElement('blockquote');
      blockquote.textContent = 'Preview';
      return blockquote;
    }
    case 'codeBlock': {
      const pre = document.createElement('pre');
      pre.textContent = 'Preview';
      return pre;
    }
    case 'paragraph':
    default:
      return withText(document.createElement('p'));
  }
}

function getBlockPreviewStyles(
  view: EditorView,
  target: HTMLElement,
  blockType: BlockType,
  styles: Record<string, string>
): Record<string, string> {
  let nextStyles = { ...styles };

  if (blockType === 'blockquote') {
    const paragraphStyles = getBlockStyles(view, 'paragraph');
    nextStyles = {
      ...paragraphStyles,
      ...nextStyles,
    };
  }

  if (!SCALE_BLOCK_PREVIEW_TYPES.has(blockType)) {
    return nextStyles;
  }

  const current = window.getComputedStyle(target);
  const currentFontSize = parseFloat(current.fontSize);
  const targetFontSize = parseFloat(nextStyles.fontSize || '');

  delete nextStyles.fontSize;
  delete nextStyles.lineHeight;

  if (
    Number.isFinite(currentFontSize) &&
    currentFontSize > 0 &&
    Number.isFinite(targetFontSize) &&
    targetFontSize > 0
  ) {
    const scale = targetFontSize / currentFontSize;
    if (Math.abs(scale - 1) > 0.001) {
      nextStyles.transform = `scale(${scale})`;
      nextStyles.transformOrigin =
        current.textAlign === 'center'
          ? 'center top'
          : current.textAlign === 'right'
            ? 'right top'
            : 'left top';
    }
  }

  if (blockType === 'bulletList' || blockType === 'orderedList' || blockType === 'taskList') {
    nextStyles.paddingLeft = '1.5rem';
    nextStyles.position = 'relative';
    nextStyles.textAlign = 'left';
  }

  return nextStyles;
}

function getBlockPreviewAttributes(blockType: BlockType): Record<string, string> {
  if (blockType === 'orderedList') {
    return {
      'data-preview-block-type': blockType,
      'data-preview-list-label': '1.',
    };
  }

  if (
    blockType === 'bulletList' ||
    blockType === 'taskList' ||
    blockType === 'blockquote'
  ) {
    return {
      'data-preview-block-type': blockType,
    };
  }

  return {};
}

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

function resolveBlockPreviewTarget(blockType: BlockType, node: Node | null): HTMLElement | null {
  if (!(node instanceof HTMLElement)) {
    return null;
  }

  if (blockType === 'blockquote') {
    const blockquote = node.closest('blockquote');
    if (blockquote instanceof HTMLElement) {
      return blockquote;
    }
  }

  if (blockType === 'codeBlock') {
    const pre = node.closest('pre');
    if (pre instanceof HTMLElement) {
      return pre;
    }
  }

  const textBlock = node.closest('p, h1, h2, h3, h4, h5, h6');
  return textBlock instanceof HTMLElement ? textBlock : node;
}

function collectSelectedBlockElements(view: EditorView, blockType: BlockType): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const { from, to, $from } = view.state.selection;

  const pushElement = (node: Node | null) => {
    if (!(node instanceof HTMLElement) || seen.has(node)) {
      return;
    }

    seen.add(node);
    elements.push(node);
  };

  view.state.doc.nodesBetween(from, to, (node, pos) => {
    if (
      node.type.name !== 'paragraph' &&
      node.type.name !== 'heading' &&
      node.type.name !== 'code_block' &&
      node.type.name !== 'blockquote'
    ) {
      return;
    }

    const domNode = resolveBlockPreviewTarget(blockType, view.nodeDOM(pos));
    pushElement(domNode);
  });

  if (elements.length > 0) {
    return elements;
  }

  const currentNode = resolveBlockPreviewTarget(blockType, view.nodeDOM($from.before()));
  pushElement(currentNode);
  return elements;
}

export function applyFormatPreview(view: EditorView, action: string, isActive: boolean = false): void {
  clearFormatPreview(view);

  const { selection } = view.state;
  if (selection.empty) return;

  const styles = isActive ? getResetStyles(action) : getFormatStyles(action);
  if (Object.keys(styles).length === 0) return;

  showInlineFormatPreview(view, selection.from, selection.to, styles);
}

export function applyBlockPreview(view: EditorView, blockType: BlockType): void {
  clearFormatPreview(view);

  const styles = getBlockStyles(view, blockType);
  if (Object.keys(styles).length === 0) {
    return;
  }

  withDomObserverPaused(view, () => {
    try {
      const targets = collectSelectedBlockElements(view, blockType);

      for (const target of targets) {
        const previewStyles = getBlockPreviewStyles(view, target, blockType, styles);
        const previewAttributes = getBlockPreviewAttributes(blockType);
        if (Object.keys(previewStyles).length === 0 && Object.keys(previewAttributes).length === 0) {
          continue;
        }

        const originalStyles: Record<string, string> = {};
        Object.keys(previewStyles).forEach((key) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          originalStyles[key] = target.style.getPropertyValue(cssKey);
        });

        const originalAttributes: Record<string, string | null> = {};
        Object.keys(previewAttributes).forEach((key) => {
          originalAttributes[key] = target.getAttribute(key);
        });

        previewNodes.push({ kind: 'style', node: target, originalStyles, originalAttributes });

        Object.entries(previewStyles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          target.style.setProperty(cssKey, value, 'important');
        });

        Object.entries(previewAttributes).forEach(([key, value]) => {
          target.setAttribute(key, value);
        });
      }
    } catch {
      previewNodes = [];
    }
  });
}

export function clearFormatPreview(view: EditorView): void {
  clearInlineFormatPreview(view);
  if (previewNodes.length === 0) return;

  withDomObserverPaused(view, () => {
    try {
      for (const entry of previewNodes) {
        const { node, originalStyles, originalAttributes } = entry;
        if (!document.body.contains(node)) continue;

        Object.entries(originalStyles).forEach(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          node.style.removeProperty(cssKey);
          if (value) {
            node.style.setProperty(cssKey, value);
          }
        });

        Object.entries(originalAttributes).forEach(([key, value]) => {
          if (value == null) {
            node.removeAttribute(key);
            return;
          }

          node.setAttribute(key, value);
        });
      }
    } catch {}

    previewNodes = [];
  });
}
