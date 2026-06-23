import { $prose } from '@milkdown/kit/utils';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView, NodeView } from '@milkdown/kit/prose/view';
import { translate } from '@/lib/i18n';
import { themeDomStyleTokens } from '@/styles/themeTokens';
import { attachPreviewContextMenu, type PreviewContextMenuSession } from '../shared/previewContextMenu';
import { shouldSuppressPreviewEditorOpen } from '../shared/previewContextMenuSuppression';
import { createTextEditorViewSession } from '../shared/textEditorViewSession';
import {
  renderRawMarkdownHtmlValueIntoElement,
  sanitizeRawMarkdownHtmlValue,
} from '../../themeTextSchemaOverrides';

const HTML_BLOCK_SELECTOR = '[data-type="html-block"]';
const MARKDOWN_HTML_BLOCK_START_PATTERN = /^\s*(?:<\/?[A-Za-z][^>]*>|<!--|<![A-Za-z]|<\?)/;
const INTERNAL_HTML_BLOCK_VALUES = new Set([
  '<!--vlaina-markdown-blank-line-->',
  '<!--vlaina-rendered-html-boundary-blank-line-->',
  '<!--vlaina-markdown-tight-heading-->',
]);

interface HtmlBlockEditorState {
  isOpen: boolean;
  value: string;
  position: { x: number; y: number };
  nodePos: number;
}

interface HtmlBlockEditorSessionRefs {
  textareaElement: HTMLTextAreaElement | null;
  draftValue: string;
  initialValue: string;
}

interface HtmlBlockNodeLike {
  type: { name: string };
  attrs: Record<string, unknown> & { value?: string };
  nodeSize?: number;
}

interface HtmlBlockEditorViewLike<TTransaction = unknown> {
  dom: HTMLElement;
  state: {
    doc: {
      resolve: (pos: number) => {
        depth: number;
        node: (depth: number) => ProseNode;
        before: (depth: number) => number;
      };
      nodeAt: (pos: number) => HtmlBlockNodeLike | null;
    };
    tr: {
      setMeta?: (key: PluginKey<HtmlBlockEditorState>, value: HtmlBlockEditorState) => TTransaction;
      setNodeMarkup: (
        pos: number,
        type: undefined,
        attrs: Record<string, unknown>
      ) => TTransaction;
      delete: (from: number, to: number) => TTransaction;
    };
  };
  dispatch: (tr: TTransaction) => void;
  posAtDOM: (node: Node, offset: number) => number;
  nodeDOM?: (pos: number) => Node | null;
}

export const htmlBlockEditorPluginKey =
  new PluginKey<HtmlBlockEditorState>('htmlBlockEditor');

function createClosedHtmlBlockEditorState(): HtmlBlockEditorState {
  return {
    isOpen: false,
    value: '',
    position: { x: 0, y: 0 },
    nodePos: -1,
  };
}

export function createOpenHtmlBlockEditorState(args: {
  value: string;
  position: { x: number; y: number };
  nodePos: number;
}): HtmlBlockEditorState {
  return {
    isOpen: true,
    value: args.value,
    position: args.position,
    nodePos: args.nodePos,
  };
}

function getSuppressDeadline() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function isEditableHtmlBlockValue(value: unknown): value is string {
  return typeof value === 'string' && !INTERNAL_HTML_BLOCK_VALUES.has(value.trim());
}

function findHtmlBlockEditorTargetElement(
  view: { dom: HTMLElement },
  target: EventTarget | null
) {
  const targetElement =
    target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null;
  const htmlBlockElement = targetElement?.closest(HTML_BLOCK_SELECTOR);

  if (!(htmlBlockElement instanceof HTMLElement) || !view.dom.contains(htmlBlockElement)) {
    return null;
  }

  return htmlBlockElement;
}

function resolveHtmlBlockAnchorElement(target: EventTarget | null, fallback: Node | null) {
  const targetElement =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const closestHtmlBlockElement = targetElement?.closest(HTML_BLOCK_SELECTOR);

  if (closestHtmlBlockElement instanceof HTMLElement) {
    return closestHtmlBlockElement;
  }

  if (fallback instanceof HTMLElement) {
    return fallback;
  }

  return targetElement instanceof HTMLElement ? targetElement : null;
}

function getHtmlBlockAnchorViewportPosition(anchorElement: HTMLElement | null) {
  if (!anchorElement) {
    return {
      x: themeDomStyleTokens.editorPopupFallbackX,
      y: themeDomStyleTokens.editorPopupFallbackY,
    };
  }

  const rect = anchorElement.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.bottom + themeDomStyleTokens.editorPopupAnchorOffsetPx,
  };
}

function isHtmlBlockScrollbarPointerDown(args: {
  event: MouseEvent;
  htmlBlockElement: HTMLElement;
}) {
  const { event, htmlBlockElement } = args;
  if (typeof window === 'undefined') {
    return false;
  }

  const overflowX = window.getComputedStyle(htmlBlockElement).overflowX;
  const scrollbarHeight = htmlBlockElement.offsetHeight - htmlBlockElement.clientHeight;
  const hasHorizontalScrollbar =
    (overflowX === 'auto' || overflowX === 'scroll') &&
    htmlBlockElement.scrollWidth > htmlBlockElement.clientWidth &&
    scrollbarHeight > 0;

  if (!hasHorizontalScrollbar) {
    return false;
  }

  const rect = htmlBlockElement.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.bottom - scrollbarHeight &&
    event.clientY <= rect.bottom
  );
}

function resolveHtmlBlockEditorOpenState(args: {
  view: HtmlBlockEditorViewLike;
  pos: number;
  getPosition: (nodePos: number) => { x: number; y: number };
}): HtmlBlockEditorState | null {
  const { view, pos, getPosition } = args;
  const $pos = view.state.doc.resolve(pos);
  const node = view.state.doc.nodeAt(pos);

  if (node?.type.name === 'html_block' && isEditableHtmlBlockValue(node.attrs.value)) {
    return createOpenHtmlBlockEditorState({
      value: node.attrs.value,
      position: getPosition(pos),
      nodePos: pos,
    });
  }

  for (let depth = $pos.depth; depth > 0; depth--) {
    const parentNode = $pos.node(depth);
    if (parentNode.type.name !== 'html_block' || !isEditableHtmlBlockValue(parentNode.attrs.value)) {
      continue;
    }

    const parentPos = $pos.before(depth);
    return createOpenHtmlBlockEditorState({
      value: parentNode.attrs.value,
      position: getPosition(parentPos),
      nodePos: parentPos,
    });
  }

  return null;
}

function resolveHtmlBlockEditorOpenMeta(args: {
  view: HtmlBlockEditorViewLike;
  pos: number;
  target: EventTarget | null;
}) {
  const { view, pos, target } = args;
  return resolveHtmlBlockEditorOpenState({
    view,
    pos,
    getPosition(nodePos) {
      return getHtmlBlockAnchorViewportPosition(
        resolveHtmlBlockAnchorElement(
          target,
          typeof view.nodeDOM === 'function' ? view.nodeDOM(nodePos) : null
        )
      );
    },
  });
}

function resolveHtmlBlockEditorPointerOpen(args: {
  view: HtmlBlockEditorViewLike;
  target: EventTarget | null;
}) {
  const { view, target } = args;
  const htmlBlockElement = findHtmlBlockEditorTargetElement(view, target);
  if (!htmlBlockElement) {
    return null;
  }

  try {
    const meta = resolveHtmlBlockEditorOpenMeta({
      view,
      pos: view.posAtDOM(htmlBlockElement, 0),
      target,
    });

    if (!meta) {
      return null;
    }

    return { htmlBlockElement, meta };
  } catch {
    return null;
  }
}

function markHtmlBlockUserInput(editorView: { dom?: { dispatchEvent?: (event: Event) => boolean } }) {
  editorView.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

export function normalizeHtmlBlockEditorValueForMarkdown(value: string): string {
  const safeValue = sanitizeRawMarkdownHtmlValue(value);
  if (!safeValue.trim() || MARKDOWN_HTML_BLOCK_START_PATTERN.test(safeValue)) {
    return safeValue;
  }

  return `<div>${safeValue.replace(/\n/g, '<br>\n')}</div>`;
}

function applyHtmlBlockValue<TTransaction>(
  editorView: HtmlBlockEditorViewLike<TTransaction>,
  nodePos: number,
  value: string
) {
  if (nodePos < 0) {
    return false;
  }

  const node = editorView.state.doc.nodeAt(nodePos);
  if (!node || node.type.name !== 'html_block') {
    return false;
  }

  if (node.attrs.value === value) {
    return false;
  }

  const tr = editorView.state.tr.setNodeMarkup(nodePos, undefined, {
    ...node.attrs,
    value,
  });
  markHtmlBlockUserInput(editorView);
  editorView.dispatch(tr);
  return true;
}

function removeHtmlBlockNode<TTransaction>(
  editorView: HtmlBlockEditorViewLike<TTransaction>,
  nodePos: number
) {
  if (nodePos < 0) {
    return false;
  }

  const node = editorView.state.doc.nodeAt(nodePos);
  if (!node || node.type.name !== 'html_block') {
    return false;
  }

  const tr = editorView.state.tr.delete(nodePos, nodePos + Math.max(1, node.nodeSize ?? 1));
  markHtmlBlockUserInput(editorView);
  editorView.dispatch(tr);
  return true;
}

function closeHtmlBlockEditorSession(args: {
  editorView: EditorView;
  resetSessionDom: () => void;
}) {
  const { editorView, resetSessionDom } = args;
  resetSessionDom();
  editorView.dispatch(
    editorView.state.tr.setMeta(htmlBlockEditorPluginKey, createClosedHtmlBlockEditorState())
  );
}

function resolveCurrentDraftValue(
  refs: HtmlBlockEditorSessionRefs,
  nextDraftValue?: string
) {
  if (typeof nextDraftValue === 'string') {
    refs.draftValue = nextDraftValue;
    return refs.draftValue;
  }

  if (refs.textareaElement) {
    refs.draftValue = refs.textareaElement.value;
  }

  return refs.draftValue;
}

function renderHtmlBlockEditorLivePreview(args: {
  anchor: HTMLElement | null;
  value: string;
}) {
  const { anchor, value } = args;
  if (!anchor) {
    return;
  }

  renderRawMarkdownHtmlValueIntoElement(anchor, sanitizeRawMarkdownHtmlValue(value));
}

function getHtmlBlockNodeValue(node: ProseNode) {
  return typeof node.attrs.value === 'string' ? node.attrs.value : '';
}

function createHtmlBlockElement(node: ProseNode) {
  const value = sanitizeRawMarkdownHtmlValue(getHtmlBlockNodeValue(node));
  const element = document.createElement('div');
  element.dataset.type = 'html-block';
  element.classList.add('md-htmlblock', 'md-htmlblock-container');
  renderRawMarkdownHtmlValueIntoElement(element, value);
  return element;
}

class HtmlBlockNodeView implements NodeView {
  dom: HTMLElement;
  private node: ProseNode;
  private contextMenu: PreviewContextMenuSession | null = null;
  private view: EditorView;
  private getPos: () => number | undefined;

  constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.dom = createHtmlBlockElement(node);
    this.ensureContextMenu();
  }

  private ensureContextMenu() {
    if (!isEditableHtmlBlockValue(getHtmlBlockNodeValue(this.node))) {
      this.contextMenu?.destroy();
      this.contextMenu = null;
      return;
    }

    if (this.contextMenu) {
      this.contextMenu.updateNode(this.node);
      return;
    }

    this.contextMenu = attachPreviewContextMenu({
      element: this.dom,
      fileBaseName: 'html-block',
      getPos: this.getPos,
      node: this.node,
      view: this.view,
    });
  }

  update(node: ProseNode) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    const value = sanitizeRawMarkdownHtmlValue(getHtmlBlockNodeValue(node));
    if (this.dom.dataset.value !== value) {
      renderRawMarkdownHtmlValueIntoElement(this.dom, value);
    }

    this.ensureContextMenu();
    return true;
  }

  ignoreMutation() {
    return true;
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode', 'md-focus');
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode', 'md-focus');
  }

  destroy() {
    this.contextMenu?.destroy();
    this.contextMenu = null;
  }
}

function createHtmlBlockEditorViewSession(args: {
  editorView: EditorView;
  onOutsideCloseIntent: () => void;
}) {
  const { editorView, onOutsideCloseIntent } = args;
  const refs: HtmlBlockEditorSessionRefs = {
    textareaElement: null,
    draftValue: '',
    initialValue: '',
  };

  return createTextEditorViewSession<HtmlBlockEditorState, HtmlBlockEditorSessionRefs>({
    editorView,
    onOutsideCloseIntent,
    refs,
    popupClassName: 'text-editor-popup math-editor-popup html-block-editor-popup',
    placeholder: translate('editor.htmlBlockPlaceholder'),
    getEditorState: () =>
      htmlBlockEditorPluginKey.getState(editorView.state) as HtmlBlockEditorState | undefined,
    getStateRenderKey: (state) => String(state.nodePos),
    getValue: (state) => state.value,
    setInitialValue: (nextRefs, value) => {
      nextRefs.initialValue = value;
    },
    setDraftValue: (nextRefs, value) => {
      nextRefs.draftValue = value;
    },
    getInitialValue: (nextRefs) => nextRefs.initialValue,
    resetRefs: (nextRefs) => {
      nextRefs.draftValue = '';
      nextRefs.initialValue = '';
    },
    resolveAnchorElement: (_state, nodeDom) => resolveHtmlBlockAnchorElement(null, nodeDom),
    getAnchorViewportPosition: getHtmlBlockAnchorViewportPosition,
    scrollPopupIntoViewOnInitialRender: true,
    constrainTextareaHeightToViewport: false,
    previewInput({ value, resolveAnchor, scheduleResize }) {
      renderHtmlBlockEditorLivePreview({ anchor: resolveAnchor(), value });
      scheduleResize();
    },
    previewCancel({ value, resolveAnchor, scheduleResize }) {
      renderHtmlBlockEditorLivePreview({ anchor: resolveAnchor(), value });
      scheduleResize();
    },
    cancelSession(sessionArgs) {
      const state = sessionArgs.getEditorState();
      if (state) {
        applyHtmlBlockValue(
          sessionArgs.editorView as unknown as HtmlBlockEditorViewLike,
          state.nodePos,
          sessionArgs.refs.initialValue || state.value
        );
      }
      closeHtmlBlockEditorSession(sessionArgs);
      sessionArgs.editorView.focus();
    },
    saveSession(sessionArgs) {
      const state = sessionArgs.getEditorState();
      if (!state || state.nodePos < 0) {
        closeHtmlBlockEditorSession(sessionArgs);
        return;
      }

      const draftValue = normalizeHtmlBlockEditorValueForMarkdown(resolveCurrentDraftValue(sessionArgs.refs));
      if (!draftValue.trim()) {
        removeHtmlBlockNode(sessionArgs.editorView as unknown as HtmlBlockEditorViewLike, state.nodePos);
      } else {
        applyHtmlBlockValue(
          sessionArgs.editorView as unknown as HtmlBlockEditorViewLike,
          state.nodePos,
          draftValue
        );
      }

      closeHtmlBlockEditorSession(sessionArgs);
      sessionArgs.editorView.focus();
    },
  });
}

const SUPPRESS_CLICK_AFTER_POINTER_OPEN_MS = 250;

export const htmlBlockEditorPlugin = $prose(() => {
  let suppressOpenUntil = 0;
  let suppressClickUntil = 0;

  const shouldIgnoreOpen = (state: HtmlBlockEditorState | null | undefined) => {
    if (state?.isOpen) {
      return true;
    }

    return getSuppressDeadline() < suppressOpenUntil;
  };

  return new Plugin<HtmlBlockEditorState>({
    key: htmlBlockEditorPluginKey,
    state: {
      init: () => createClosedHtmlBlockEditorState(),
      apply(tr, state) {
        const meta = tr.getMeta(htmlBlockEditorPluginKey);
        if (meta) {
          return { ...state, ...meta };
        }

        return state;
      },
    },
    props: {
      nodeViews: {
        html_block: (node, view, getPos) =>
          new HtmlBlockNodeView(node, view, getPos as () => number | undefined),
      },
      handleDOMEvents: {
        mousedown(view, event) {
          const htmlBlockElement = findHtmlBlockEditorTargetElement(view, event.target);

          if (shouldSuppressPreviewEditorOpen() && htmlBlockElement) {
            event.preventDefault();
            suppressClickUntil = getSuppressDeadline() + SUPPRESS_CLICK_AFTER_POINTER_OPEN_MS;
            return true;
          }

          if (shouldIgnoreOpen(htmlBlockEditorPluginKey.getState(view.state))) {
            return false;
          }

          if (!(event instanceof MouseEvent) || event.button !== 0) {
            return false;
          }

          const openRequest = resolveHtmlBlockEditorPointerOpen({
            view: view as unknown as HtmlBlockEditorViewLike,
            target: event.target,
          });
          if (!openRequest) {
            return false;
          }

          if (isHtmlBlockScrollbarPointerDown({
            event,
            htmlBlockElement: openRequest.htmlBlockElement,
          })) {
            return false;
          }

          event.preventDefault();
          suppressClickUntil = getSuppressDeadline() + SUPPRESS_CLICK_AFTER_POINTER_OPEN_MS;
          view.dispatch(view.state.tr.setMeta(htmlBlockEditorPluginKey, openRequest.meta));
          return true;
        },
      },
      handleClick(view, _pos, event) {
        const htmlBlockElement = findHtmlBlockEditorTargetElement(view, event.target);

        if (getSuppressDeadline() < suppressClickUntil) {
          event.preventDefault();
          return true;
        }

        if (!htmlBlockElement) {
          return false;
        }

        if (shouldSuppressPreviewEditorOpen()) {
          event.preventDefault();
          return true;
        }

        if (shouldIgnoreOpen(htmlBlockEditorPluginKey.getState(view.state))) {
          return false;
        }

        if (isHtmlBlockScrollbarPointerDown({ event, htmlBlockElement })) {
          return false;
        }

        const openRequest = resolveHtmlBlockEditorPointerOpen({
          view: view as unknown as HtmlBlockEditorViewLike,
          target: event.target,
        });
        if (!openRequest) {
          return false;
        }

        view.dispatch(view.state.tr.setMeta(htmlBlockEditorPluginKey, openRequest.meta));
        return true;
      },
    },
    view(editorView) {
      const editorSession = createHtmlBlockEditorViewSession({
        editorView,
        onOutsideCloseIntent() {
          suppressOpenUntil = getSuppressDeadline() + 120;
        },
      });

      return {
        update() {
          editorSession.update();
        },
        destroy() {
          editorSession.destroy();
        },
      };
    },
  });
});
