import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { isNoteTagToken } from '@/lib/notes/tags';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../shared/boundedProseNodeScan';

export const tagTokenPluginKey = new PluginKey<DecorationSet>('editorTagToken');

const TAG_TOKEN_PATTERN = /(?<![\p{L}\p{N}_/-])#([\p{L}\p{N}_/-][\p{L}\p{N}_/-]*)/gu;
const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);
export const MAX_TAG_TOKEN_DECORATIONS = 1000;
export const MAX_TAG_TOKEN_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
const MAX_TAG_TOKEN_CHARS = 128;
export const MAX_TAG_TOKEN_EDGE_RECTS = 1024;

export function resolveTagTokenEdgeOffset(
  token: HTMLElement,
  clientX: number,
  clientY: number,
): { textNode: Text; offset: number } | null {
  let textNode: Text | null = null;
  for (let index = 0; index < token.childNodes.length; index += 1) {
    const child = token.childNodes.item(index);
    if (child.nodeType === Node.TEXT_NODE && child.textContent) {
      textNode = child as Text;
      break;
    }
  }
  if (!textNode?.textContent) return null;

  const range = token.ownerDocument.createRange();
  range.selectNodeContents(textNode);
  const rects = range.getClientRects();
  if (rects.length > MAX_TAG_TOKEN_EDGE_RECTS) {
    range.detach();
    return null;
  }

  let lastRect: DOMRect | null = null;
  let matchedRect: DOMRect | null = null;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects.item(index);
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    lastRect = rect;
    if (clientY >= rect.top - 4 && clientY <= rect.bottom + 4) {
      matchedRect = rect;
      break;
    }
  }
  range.detach();

  const rect = matchedRect ?? lastRect;
  if (!rect) return null;

  const edgeSlack = Math.max(3, Math.min(8, rect.width * 0.12));
  if (clientX >= rect.right - edgeSlack) {
    return { textNode, offset: textNode.textContent.length };
  }
  if (clientX <= rect.left + edgeSlack) {
    return { textNode, offset: 0 };
  }
  return null;
}

export function createTagTokenDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  scanProseDescendants(doc, (node, pos, parent) => {
    if (decorations.length >= MAX_TAG_TOKEN_DECORATIONS) {
      return STOP_PROSE_SCAN;
    }

    if (!node.isText) {
      return;
    }

    if (parent && SKIPPED_TEXT_PARENT_TYPES.has(parent.type?.name)) {
      return;
    }

    if (node.marks?.some((mark: any) => SKIPPED_MARK_TYPES.has(mark.type?.name))) {
      return;
    }

    const text = node.text ?? '';
    TAG_TOKEN_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TAG_TOKEN_PATTERN.exec(text)) !== null) {
      const tag = match[1]?.trim();
      if (!tag || tag.length > MAX_TAG_TOKEN_CHARS || !isNoteTagToken(tag)) {
        continue;
      }

      decorations.push(
        Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
          class: `editor-tag-token tag cm-hashtag cm-meta v-tag ${chatComposerPillSurfaceClass}`,
          'data-editor-tag-token': 'true',
        }, {
          inclusiveStart: false,
          inclusiveEnd: false,
        }),
      );
      if (decorations.length >= MAX_TAG_TOKEN_DECORATIONS) {
        break;
      }
    }

    return decorations.length < MAX_TAG_TOKEN_DECORATIONS ? undefined : STOP_PROSE_SCAN;
  }, MAX_TAG_TOKEN_DOC_SCAN_NODES);

  return decorations.length > 0
    ? DecorationSet.create(doc, decorations)
    : DecorationSet.empty;
}

export const tagTokenPlugin = $prose(() => new Plugin({
  key: tagTokenPluginKey,
  state: {
    init: (_config, state) => createTagTokenDecorations(state.doc),
    apply: (tr, previous) => tr.docChanged
      ? createTagTokenDecorations(tr.doc)
      : previous,
  },
  props: {
    decorations(state) {
      return tagTokenPluginKey.getState(state) ?? DecorationSet.empty;
    },
    handleDOMEvents: {
      mousedown(view, event) {
        if (!(event instanceof MouseEvent)) return false;
        if (event.button !== 0) return false;
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
        const target = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
        const token = target?.closest('[data-editor-tag-token="true"]');
        if (!(token instanceof HTMLElement) || !view.dom.contains(token)) return false;

        const edge = resolveTagTokenEdgeOffset(token, event.clientX, event.clientY);
        if (!edge) return false;

        try {
          const pos = view.posAtDOM(edge.textNode, edge.offset);
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)).scrollIntoView());
          view.focus();
          event.preventDefault();
          return true;
        } catch {
          return false;
        }
      },
    },
  },
}));
