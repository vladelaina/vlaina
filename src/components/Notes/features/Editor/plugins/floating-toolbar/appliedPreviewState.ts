import { DOMSerializer } from '@milkdown/kit/prose/model';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { CodeBlockNodeView } from '../code/CodeBlockNodeView';

const previewCleanupCallbacks = new WeakMap<HTMLElement, () => void>();

export function createAppliedPreviewState(
  view: EditorView,
  apply: (previewView: EditorView) => void
): EditorState {
  const previewView: any = {
    ...view,
    state: view.state,
    dom: {},
    dispatch(tr: Transaction) {
      previewView.state = previewView.state.apply(tr);
    },
    focus() {},
    nodeDOM() {
      return null;
    },
  };

  apply(previewView as EditorView);
  return previewView.state;
}

export function renderAppliedPreviewDocument(
  state: EditorState,
  sourceDom: HTMLElement | null,
  ownerDocument: Document,
  extraClassName?: string,
  view?: EditorView
): HTMLElement {
  const previewDom = sourceDom
    ? sourceDom.cloneNode(false) as HTMLElement
    : ownerDocument.createElement('div');
  const className = sourceDom?.className || 'ProseMirror';
  previewDom.className = extraClassName ? `${className} ${extraClassName}` : className;
  previewDom.removeAttribute('data-toolbar-preview-hidden');
  if (!previewDom.hasAttribute('contenteditable')) {
    previewDom.setAttribute('contenteditable', 'true');
  }
  previewDom.setAttribute('aria-hidden', 'true');
  previewDom.appendChild(
    DOMSerializer.fromSchema(state.schema).serializeFragment(
      state.doc.content,
      { document: ownerDocument }
    )
  );
  addProseMirrorTrailingBreaks(previewDom, state.doc, ownerDocument);
  const didPreserveCodeBlocks = preserveSourceCodeBlockNodeViews(previewDom, sourceDom);
  if (!didPreserveCodeBlocks && view) {
    // Serialized ProseMirror output is not enough for custom-rendered blocks.
    // Rehydrate preview-only code blocks with the same node view used by the
    // live editor so hover previews stay equivalent to the committed result.
    renderCodeBlockNodeViewPreviews(previewDom, state, view);
  }
  stabilizePreviewRootTypography(previewDom, sourceDom);
  return previewDom;
}

export function cleanupAppliedPreviewDocument(previewDom: HTMLElement): void {
  previewCleanupCallbacks.get(previewDom)?.();
  previewCleanupCallbacks.delete(previewDom);
}

const ROOT_TYPOGRAPHY_STYLE_PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'wordSpacing',
  'whiteSpace',
] as const;

function stabilizePreviewRootTypography(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom || typeof window === 'undefined') {
    return;
  }

  const computed = window.getComputedStyle(sourceDom);
  ROOT_TYPOGRAPHY_STYLE_PROPS.forEach((prop) => {
    const value = computed[prop];
    if (value) {
      previewDom.style[prop] = value;
    }
  });
}

function getSerializedCodeBlockElements(previewDom: HTMLElement): HTMLElement[] {
  return Array.from(previewDom.querySelectorAll<HTMLElement>('pre.code-block-wrapper, div[data-language], div')).filter((child) => {
    if (!(child instanceof HTMLElement)) {
      return false;
    }

    if (child.matches('pre.code-block-wrapper')) {
      return true;
    }

    return child.querySelector(':scope > pre > code') !== null;
  });
}

function getPreviewCodeBlockNodes(state: EditorState): Array<{ node: ProseMirrorNode; pos: number }> {
  const codeBlocks: Array<{ node: ProseMirrorNode; pos: number }> = [];

  state.doc.descendants((node, pos) => {
    if (node.type.name === 'code_block') {
      codeBlocks.push({ node, pos });
    }
  });

  return codeBlocks;
}

function renderCodeBlockNodeViewPreviews(
  previewDom: HTMLElement,
  state: EditorState,
  view: EditorView
): void {
  const previewCodeBlocks = getSerializedCodeBlockElements(previewDom);
  if (previewCodeBlocks.length === 0) {
    return;
  }

  const codeBlockNodes = getPreviewCodeBlockNodes(state);
  if (previewCodeBlocks.length !== codeBlockNodes.length) {
    return;
  }

  const nodeViews: CodeBlockNodeView[] = [];

  previewCodeBlocks.forEach((previewCodeBlock, index) => {
    const entry = codeBlockNodes[index];
    if (!entry) {
      return;
    }

    const nodeView = new CodeBlockNodeView(entry.node, view, () => undefined);
    nodeView.dom.setAttribute('aria-hidden', 'true');
    makePreviewCloneNonInteractive(nodeView.dom);
    previewCodeBlock.replaceWith(nodeView.dom);
    nodeViews.push(nodeView);
  });

  if (nodeViews.length > 0) {
    previewCleanupCallbacks.set(previewDom, () => {
      nodeViews.forEach((nodeView) => nodeView.destroy());
    });
  }
}

function preserveSourceCodeBlockNodeViews(previewDom: HTMLElement, sourceDom: HTMLElement | null): boolean {
  if (!sourceDom) {
    return false;
  }

  const sourceCodeBlocks = Array.from(sourceDom.querySelectorAll<HTMLElement>('.code-block-container'));
  if (sourceCodeBlocks.length === 0) {
    return false;
  }

  const previewCodeBlocks = getSerializedCodeBlockElements(previewDom);
  if (previewCodeBlocks.length !== sourceCodeBlocks.length) {
    return false;
  }

  previewCodeBlocks.forEach((previewCodeBlock, index) => {
    const sourceCodeBlock = sourceCodeBlocks[index];
    if (!sourceCodeBlock) {
      return;
    }

    const clone = sourceCodeBlock.cloneNode(true) as HTMLElement;
    makePreviewCloneNonInteractive(clone);
    previewCodeBlock.replaceWith(clone);
  });
  return true;
}

function makePreviewCloneNonInteractive(clone: HTMLElement): void {
  clone.setAttribute('aria-hidden', 'true');
  clone.removeAttribute('contenteditable');
  clone.removeAttribute('tabindex');
  clone.querySelectorAll<HTMLElement>('[contenteditable], [tabindex]').forEach((element) => {
    element.removeAttribute('contenteditable');
    element.removeAttribute('tabindex');
  });
}

function addProseMirrorTrailingBreaks(
  previewDom: HTMLElement,
  doc: ProseMirrorNode,
  ownerDocument: Document
): void {
  addTrailingBreaksForChildren(previewDom, doc, ownerDocument);
}

function addTrailingBreaksForChildren(
  container: HTMLElement,
  parentNode: ProseMirrorNode,
  ownerDocument: Document
): void {
  let childIndex = 0;

  parentNode.forEach((node) => {
    const child = container.children.item(childIndex);
    childIndex += 1;

    if (!(child instanceof HTMLElement)) {
      return;
    }

    if (node.isTextblock && node.content.size === 0) {
      if (!child.querySelector(':scope > .ProseMirror-trailingBreak')) {
        const br = ownerDocument.createElement('br');
        br.className = 'ProseMirror-trailingBreak';
        child.appendChild(br);
      }
      return;
    }

    if (node.childCount > 0) {
      addTrailingBreaksForChildren(child, node, ownerDocument);
    }
  });
}
