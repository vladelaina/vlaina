import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { isNoteTagToken } from '@/lib/notes/tags';

export const tagTokenPluginKey = new PluginKey<DecorationSet>('editorTagToken');

const TAG_TOKEN_PATTERN = /(?<![\p{L}\p{N}_/-])#([\p{L}\p{N}_/-][\p{L}\p{N}_/-]*)/gu;
const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);

function createTagTokenDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number, parent: any) => {
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
      if (!tag || !isNoteTagToken(tag)) {
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
    }
  });

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

        const textNode = Array.from(token.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent);
        if (!textNode?.textContent) return false;

        const range = token.ownerDocument.createRange();
        range.selectNodeContents(textNode);
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
        range.detach();
        const rect = rects.find((candidate) => event.clientY >= candidate.top - 4 && event.clientY <= candidate.bottom + 4)
          ?? rects[rects.length - 1];
        if (!rect) return false;

        const edgeSlack = Math.max(3, Math.min(8, rect.width * 0.12));
        let offset: number | null = null;
        if (event.clientX >= rect.right - edgeSlack) {
          offset = textNode.textContent.length;
        } else if (event.clientX <= rect.left + edgeSlack) {
          offset = 0;
        }
        if (offset === null) return false;

        try {
          const pos = view.posAtDOM(textNode, offset);
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
