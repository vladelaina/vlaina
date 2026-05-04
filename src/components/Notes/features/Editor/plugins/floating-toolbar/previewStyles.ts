import { DOMSerializer, Fragment } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType } from './types';
import {
  collectBlockPreviewDomAdjustments,
  getBlockPreviewStructuralStyles,
} from './blockPreviewDomAdjustments';
import { resolveOrderedListPreviewLabel } from './blockPreviewListLabel';
import { clearInlineFormatPreview, showInlineFormatPreview } from './inlinePreviewPlugin';
import { getFormattableTextRanges } from './selectionHelpers';
import { getSelectedCodeBlockSourceText, inferCodeBlockLanguage } from './blockCommands';
import { codeBlockLanguages } from '../code/codeBlockLanguageLoader';

const FORMAT_SELECTORS: Record<string, string> = {
  bold: '.milkdown strong',
  italic: '.milkdown em',
  underline: '.milkdown u',
  strike: '.milkdown del, .milkdown s',
  code: '.milkdown code:not(pre code)',
  highlight: '.milkdown mark.highlight, .milkdown mark',
};

const FORMAT_MARKS: Record<string, string> = {
  bold: 'strong',
  italic: 'emphasis',
  underline: 'underline',
  strike: 'strike_through',
  code: 'inlineCode',
  highlight: 'highlight',
};

const FALLBACK_STYLES: Record<string, Record<string, string>> = {
  bold: { fontWeight: '600' },
  italic: { fontStyle: 'italic' },
  underline: { textDecoration: 'underline' },
  strike: { textDecoration: 'line-through' },
  code: {
    fontFamily: 'inherit',
    fontSize: '13px',
    backgroundColor: 'var(--vlaina-bg-secondary)',
    border: '1px solid var(--vlaina-border)',
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
    color: 'var(--vlaina-text-secondary)',
    lineHeight: '26px',
    paddingLeft: '17px',
    paddingTop: '10px',
    paddingBottom: '10px',
    marginTop: '8px',
    position: 'relative',
    fontStyle: 'normal',
  },
  codeBlock: {
    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
    fontSize: '0.875rem',
    lineHeight: '1.7',
    backgroundColor: 'var(--vlaina-code-block-background, #f5f5f5)',
    borderRadius: '1rem',
    padding: '2.75rem 1rem 1rem',
    marginTop: '1rem',
    marginBottom: '1rem',
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
  paragraph: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  heading1: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  heading2: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  heading3: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  heading4: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  heading5: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  heading6: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  bulletList: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  orderedList: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  taskList: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'],
  blockquote: ['color', 'lineHeight', 'paddingLeft', 'paddingTop', 'paddingBottom', 'marginTop', 'marginBottom', 'position', 'fontStyle'],
  codeBlock: ['fontFamily', 'fontSize', 'lineHeight', 'backgroundColor', 'borderRadius', 'padding', 'color', 'marginTop', 'marginBottom', 'overflow'],
};

const styleCache: Record<string, Record<string, string>> = {};
type StylePreviewEntry = {
  kind: 'style';
  node: HTMLElement;
  originalStyles: Record<string, string>;
  originalAttributes: Record<string, string | null>;
  originalInnerHTML?: string;
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

function getFormatStyles(view: EditorView, action: string): Record<string, string> {
  const themeKey = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const cacheKey = `format:${themeKey}:${action}`;
  if (styleCache[cacheKey]) {
    return styleCache[cacheKey];
  }

  const probedStyles = getFormatStylesFromSchemaProbe(view, action);
  if (Object.keys(probedStyles).length > 0) {
    styleCache[cacheKey] = probedStyles;
    return probedStyles;
  }

  const selector = FORMAT_SELECTORS[action];
  if (!selector) {
    return {};
  }

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

    styleCache[cacheKey] = styles;
    return styles;
  }

  return FALLBACK_STYLES[action] || {};
}

function getFormatStylesFromSchemaProbe(view: EditorView, action: string): Record<string, string> {
  const markName = FORMAT_MARKS[action];
  const markType = markName ? view.state.schema.marks[markName] : null;
  const props = STYLE_PROPS[action] || [];
  if (!markType || props.length === 0) {
    return {};
  }

  const proseRoot = viewRootForProbe(view);
  if (!proseRoot) {
    return {};
  }

  const probeHost = document.createElement('span');
  probeHost.setAttribute('aria-hidden', 'true');
  probeHost.style.position = 'absolute';
  probeHost.style.left = '-99999px';
  probeHost.style.top = '0';
  probeHost.style.visibility = 'hidden';
  probeHost.style.pointerEvents = 'none';
  probeHost.style.contain = 'layout style paint';

  try {
    const mark = markType.create();
    const textNode = view.state.schema.text('Preview', [mark]);
    const fragment = DOMSerializer
      .fromSchema(view.state.schema)
      .serializeFragment(Fragment.from(textNode), {
        document: view.dom.ownerDocument,
      });

    probeHost.appendChild(fragment);
    proseRoot.appendChild(probeHost);

    const element = probeHost.querySelector('*') as HTMLElement | null;
    if (!element) {
      return {};
    }

    const computed = window.getComputedStyle(element);
    const styles: Record<string, string> = {};

    props.forEach((prop) => {
      const value = getCssValue(computed, prop);
      if (value) {
        styles[prop] = value;
      }
    });

    return styles;
  } catch {
    return {};
  } finally {
    probeHost.remove();
  }
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
      const container = document.createElement('div');
      container.className = 'code-block-container';
      const header = document.createElement('div');
      header.className = 'code-block-preview-header';
      header.textContent = 'txt';
      const editable = document.createElement('div');
      editable.className = 'code-block-editable';
      const editor = document.createElement('div');
      editor.className = 'cm-editor';
      const line = document.createElement('div');
      line.className = 'cm-line';
      line.textContent = 'Preview';
      editor.appendChild(line);
      editable.appendChild(editor);
      container.appendChild(header);
      container.appendChild(editable);
      return container;
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
      position: 'relative',
      fontStyle: 'normal',
    };
  }

  if (blockType === 'codeBlock') {
    nextStyles = {
      ...nextStyles,
      display: 'block',
      position: 'relative',
      overflow: 'hidden',
      overflowX: 'auto',
      whiteSpace: 'pre',
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
      fontSize: '0.875rem',
      lineHeight: '1.7',
      backgroundColor: 'var(--vlaina-code-block-background, #f5f5f5)',
      borderRadius: '1rem',
      padding: '2.75rem 1rem 1rem',
      marginTop: '1rem',
      marginBottom: '1rem',
    };
  }

  if (target.matches(':first-child')) {
    if (blockType === 'paragraph' || blockType === 'heading1') {
      nextStyles.marginTop = '0px';
    }
  }

  if (blockType === 'bulletList' || blockType === 'orderedList' || blockType === 'taskList') {
    nextStyles.paddingLeft = '1.5rem';
    nextStyles.position = 'relative';
    nextStyles.textAlign = 'left';
  }

  return {
    ...nextStyles,
    ...getBlockPreviewStructuralStyles(target),
  };
}

function getBlockPreviewAttributes(
  target: HTMLElement,
  blockType: BlockType,
  targetIndex: number
): Record<string, string> {
  if (blockType === 'orderedList') {
    return {
      'data-preview-block-type': blockType,
      'data-preview-list-label': resolveOrderedListPreviewLabel(target, targetIndex),
    };
  }

  if (
    blockType === 'bulletList' ||
    blockType === 'taskList' ||
    blockType === 'blockquote' ||
    blockType === 'codeBlock'
  ) {
    const attributes: Record<string, string> = {
      'data-preview-block-type': blockType,
    };
    if (blockType === 'codeBlock') {
      attributes['data-preview-code-language'] = getCodeBlockPreviewLanguageLabel(null);
    }

    return attributes;
  }

  return {};
}

function getCodeBlockPreviewLanguageLabel(language: string | null): string {
  const resolvedLanguage = language ?? 'txt';
  const languageInfo = codeBlockLanguages.find(
    (item) => item.id === resolvedLanguage || item.aliases.includes(resolvedLanguage)
  );
  return languageInfo?.name ?? resolvedLanguage;
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

function isRestrictedPreviewTarget(blockType: BlockType, node: HTMLElement | null): boolean {
  if (!node) {
    return false;
  }

  if (node.closest('.frontmatter-block-container')) {
    return true;
  }

  if (blockType !== 'codeBlock' && node.closest('.code-block-container')) {
    return true;
  }

  return false;
}

function collectSelectedBlockElements(view: EditorView, blockType: BlockType): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const { from, to, $from } = view.state.selection;

  const pushElement = (node: Node | null) => {
    if (
      !(node instanceof HTMLElement) ||
      seen.has(node) ||
      isRestrictedPreviewTarget(blockType, node)
    ) {
      return;
    }

    seen.add(node);
    elements.push(node);
  };

  view.state.doc.nodesBetween(from, to, (node, pos) => {
    if (
      node.type.name !== 'paragraph' &&
      node.type.name !== 'heading' &&
      !(blockType === 'blockquote' && node.type.name === 'blockquote') &&
      !(blockType === 'codeBlock' && node.type.name === 'code_block')
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

  const ranges = getFormattableTextRanges(view);
  if (ranges.length === 0) return;

  const styles = isActive ? getResetStyles(action) : getFormatStyles(view, action);
  if (Object.keys(styles).length === 0) return;

  showInlineFormatPreview(view, ranges, styles);
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
      const seenNodes = new Set<HTMLElement>();

      if (blockType === 'codeBlock') {
        applySingleCodeBlockPreview(view, targets, styles, seenNodes);
        return;
      }

      for (const [targetIndex, target] of targets.entries()) {
        const previewStyles = getBlockPreviewStyles(view, target, blockType, styles);
        const previewAttributes = getBlockPreviewAttributes(target, blockType, targetIndex);
        if (Object.keys(previewStyles).length === 0 && Object.keys(previewAttributes).length === 0) {
          continue;
        }

        registerPreviewMutation(target, previewStyles, previewAttributes, seenNodes);

        for (const adjustment of collectBlockPreviewDomAdjustments(target)) {
          registerPreviewMutation(adjustment.node, {}, adjustment.attributes, seenNodes);
        }
      }
    } catch {
      previewNodes = [];
    }
  });
}

function applySingleCodeBlockPreview(
  view: EditorView,
  targets: HTMLElement[],
  styles: Record<string, string>,
  seenNodes: Set<HTMLElement>
): void {
  const [primaryTarget, ...secondaryTargets] = targets;
  if (!primaryTarget) {
    return;
  }

  const previewStyles = getBlockPreviewStyles(view, primaryTarget, 'codeBlock', styles);
  const previewAttributes = {
    'data-preview-block-type': 'codeBlock',
    'data-preview-code-language': getCodeBlockPreviewLanguageLabel(inferCodeBlockLanguage(view)),
  };
  registerPreviewMutation(
    primaryTarget,
    previewStyles,
    previewAttributes,
    seenNodes,
    getSelectedCodeBlockSourceText(view)
  );

  for (const target of secondaryTargets) {
    registerPreviewMutation(target, { display: 'none' }, {}, seenNodes);
    for (const adjustment of collectBlockPreviewDomAdjustments(target)) {
      registerPreviewMutation(adjustment.node, {}, adjustment.attributes, seenNodes);
    }
  }

  for (const adjustment of collectBlockPreviewDomAdjustments(primaryTarget)) {
    registerPreviewMutation(adjustment.node, {}, adjustment.attributes, seenNodes);
  }
}

function registerPreviewMutation(
  node: HTMLElement,
  previewStyles: Record<string, string>,
  previewAttributes: Record<string, string>,
  seenNodes: Set<HTMLElement>,
  replacementText?: string
): void {
  if (seenNodes.has(node)) {
    Object.entries(previewStyles).forEach(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      node.style.setProperty(cssKey, value, 'important');
    });

    Object.entries(previewAttributes).forEach(([key, value]) => {
      node.setAttribute(key, value);
    });
    return;
  }

  seenNodes.add(node);

  const originalStyles: Record<string, string> = {};
  Object.keys(previewStyles).forEach((key) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    originalStyles[key] = node.style.getPropertyValue(cssKey);
  });

  const originalAttributes: Record<string, string | null> = {};
  Object.keys(previewAttributes).forEach((key) => {
    originalAttributes[key] = node.getAttribute(key);
  });

  previewNodes.push({
    kind: 'style',
    node,
    originalStyles,
    originalAttributes,
    originalInnerHTML: replacementText === undefined ? undefined : node.innerHTML,
  });

  if (replacementText !== undefined) {
    node.textContent = replacementText;
  }

  Object.entries(previewStyles).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    node.style.setProperty(cssKey, value, 'important');
  });

  Object.entries(previewAttributes).forEach(([key, value]) => {
    node.setAttribute(key, value);
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

        if (entry.originalInnerHTML !== undefined) {
          node.innerHTML = entry.originalInnerHTML;
        }

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
