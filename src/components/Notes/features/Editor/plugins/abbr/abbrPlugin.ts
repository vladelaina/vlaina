import { $mark } from '@milkdown/kit/utils';
import {
  abbrDecorationPlugin,
  abbrPluginKey,
  transactionMayAffectAbbrDecorations,
} from './abbrDecorations';
import {
  MAX_ABBR_DECORATIONS,
  MAX_ABBR_DOC_SCAN_NODES,
  MAX_ABBR_TEXT_SCAN_CHARS,
  MAX_ABBR_TITLE_CHARS,
  MAX_ABBR_UPDATE_RANGE_SCAN_NODES,
  extractAbbrDefinitions,
  findAbbrUsages,
  findAbbrUsagesInRange,
  normalizeAbbrTitle,
} from './abbrScanning';

export {
  MAX_ABBR_DECORATIONS,
  MAX_ABBR_DOC_SCAN_NODES,
  MAX_ABBR_TEXT_SCAN_CHARS,
  MAX_ABBR_TITLE_CHARS,
  MAX_ABBR_UPDATE_RANGE_SCAN_NODES,
  abbrPluginKey,
  extractAbbrDefinitions,
  findAbbrUsages,
  findAbbrUsagesInRange,
  normalizeAbbrTitle,
  transactionMayAffectAbbrDecorations,
};

export const abbrMark = $mark('abbr', () => ({
  attrs: {
    title: { default: '' },
  },
  parseDOM: [{
    tag: 'abbr',
    getAttrs: (dom) => ({
      title: normalizeAbbrTitle((dom as HTMLElement).getAttribute('title')),
    }),
  }],
  toDOM: (mark) => ['abbr', { title: normalizeAbbrTitle(mark.attrs.title), class: 'abbr' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'abbr',
    runner: (state, node, markType) => {
      const title = (node as { data?: { hProperties?: { title?: unknown } } }).data?.hProperties?.title;
      state.openMark(markType, { title: normalizeAbbrTitle(title) });
      state.next((node as { children?: unknown }).children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'abbr',
    runner: (state, _mark, node) => {
      state.addNode('text', undefined, node.text || '');
      return true;
    },
  },
}));

export const abbrPlugin = [
  abbrMark,
  abbrDecorationPlugin,
].flat();
