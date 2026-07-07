import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  renderRawMarkdownHtmlValueIntoElement,
  sanitizeRawMarkdownHtmlValue,
} from '../../themeTextSchemaOverrides';
import {
  createClosedHtmlBlockEditorState,
  htmlBlockEditorPluginKey,
  type HtmlBlockEditorSessionRefs,
  type HtmlBlockEditorViewLike,
} from './htmlBlockEditorState';

const MARKDOWN_HTML_BLOCK_START_PATTERN = /^\s*(?:<\/?[A-Za-z][^>]*>|<!--|<![A-Za-z]|<\?)/;

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

export function applyHtmlBlockValue<TTransaction>(
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

export function removeHtmlBlockNode<TTransaction>(
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

export function closeHtmlBlockEditorSession(args: {
  editorView: EditorView;
  resetSessionDom: () => void;
}) {
  const { editorView, resetSessionDom } = args;
  resetSessionDom();
  editorView.dispatch(
    editorView.state.tr.setMeta(htmlBlockEditorPluginKey, createClosedHtmlBlockEditorState())
  );
}

export function resolveCurrentDraftValue(
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

export function renderHtmlBlockEditorLivePreview(args: {
  anchor: HTMLElement | null;
  value: string;
}) {
  const { anchor, value } = args;
  if (!anchor) {
    return;
  }

  renderRawMarkdownHtmlValueIntoElement(anchor, sanitizeRawMarkdownHtmlValue(value));
}

export function getHtmlBlockNodeValue(node: ProseNode) {
  return typeof node.attrs.value === 'string' ? node.attrs.value : '';
}

export function createHtmlBlockElement(node: ProseNode) {
  const value = sanitizeRawMarkdownHtmlValue(getHtmlBlockNodeValue(node));
  const element = document.createElement('div');
  element.dataset.type = 'html-block';
  element.classList.add('md-htmlblock', 'md-htmlblock-container');
  renderRawMarkdownHtmlValueIntoElement(element, value);
  return element;
}
