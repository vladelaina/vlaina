import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { isNoteTagToken } from '@/lib/notes/tags';

export const tagTokenPluginKey = new PluginKey<DecorationSet>('vlainaTagToken');

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
          class: `vlaina-editor-tag-token ${chatComposerPillSurfaceClass}`,
        }, {
          inclusiveStart: false,
          inclusiveEnd: true,
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
  },
}));
