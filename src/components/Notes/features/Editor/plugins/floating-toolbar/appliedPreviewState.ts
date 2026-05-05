import { DOMSerializer } from '@milkdown/kit/prose/model';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

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
  extraClassName?: string
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
  stabilizePreviewRootTypography(previewDom, sourceDom);
  return previewDom;
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
