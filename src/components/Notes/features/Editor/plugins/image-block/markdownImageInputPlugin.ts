import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';
import { sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';
import { markEditorUserInput } from '../shared/userInputEvents';

const MAX_MARKDOWN_IMAGE_INPUT_CHARS = 8_192;
const MAX_MARKDOWN_IMAGE_TEXT_CHARS = 4_096;
const markdownImagePattern = /(?:!|！)(?:\[|【)(?<alt>.*?)(?:\]|】)(?:\(|（)(?<src><(?:\\.|[^>\n])+>|[^\s)）]+)(?:\s+(?:"|“)(?<title>[^"”]+)(?:"|”))?(?:\)|）)$/u;
const markdownDestinationEscapePattern = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;

function normalizeMarkdownImageDestination(value: string): string {
  const trimmed = value.trim();
  const destination = trimmed.startsWith('<') && trimmed.endsWith('>')
    ? trimmed.slice(1, -1).trim()
    : trimmed;
  return destination.replace(markdownDestinationEscapePattern, '$1');
}

export const markdownImageInputPlugin = $prose(() => new Plugin({
  props: {
    handleTextInput(view, from, to, text) {
      if (view.composing || (text !== ')' && text !== '）') || from !== to) return false;

      const { state } = view;
      const imageType = state.schema.nodes.image;
      const { selection } = state;
      if (!selection.empty || !imageType || from !== selection.from || to !== selection.to) {
        return false;
      }

      const parent = selection.$from.parent;
      if (!parent.inlineContent || parent.type.spec.code) return false;
      const parentOffset = selection.$from.parentOffset;
      const suffix = parent.textBetween(parentOffset, parent.content.size, '', '');
      if (suffix !== '' && suffix !== ')' && suffix !== '）') return false;

      const textBefore = parent.textBetween(
        Math.max(0, parentOffset - MAX_MARKDOWN_IMAGE_INPUT_CHARS),
        parentOffset,
        undefined,
        '\uFFFC',
      ) + text;
      const match = markdownImagePattern.exec(textBefore);
      const persistedSrc = normalizeMarkdownImageDestination(match?.groups?.src ?? '');
      const src = sanitizeNoteMediaSrc(persistedSrc);
      if (!match || !src) return false;

      const start = from - (match[0].length - text.length);
      const replaceTo = suffix ? to + suffix.length : to;
      const alt = (match.groups?.alt ?? '').slice(0, MAX_MARKDOWN_IMAGE_TEXT_CHARS);
      const title = (match.groups?.title ?? '').slice(0, MAX_MARKDOWN_IMAGE_TEXT_CHARS) || null;
      markEditorUserInput(view);
      view.dispatch(state.tr.replaceWith(start, replaceTo, imageType.create({
        src,
        alt,
        title,
        persistedSrc,
      })));
      return true;
    },
  },
}));
