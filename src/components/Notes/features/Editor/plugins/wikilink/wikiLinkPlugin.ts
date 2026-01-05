// WikiLinkPlugin - Obsidian-style [[wiki links]] support

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

// Regex to match [[wiki links]]
const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

export const wikiLinkPluginKey = new PluginKey('wiki-link');

/**
 * Creates decorations for wiki links in the document
 */
function createWikiLinkDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = node.text || '';
      let match;
      
      while ((match = WIKI_LINK_REGEX.exec(text)) !== null) {
        const start = pos + match.index;
        const end = start + match[0].length;
        const linkText = match[1];
        
        decorations.push(
          Decoration.inline(start, end, {
            class: 'wiki-link',
            'data-link': linkText,
          })
        );
      }
    }
  });
  
  return DecorationSet.create(doc, decorations);
}

/**
 * Milkdown plugin for wiki links
 */
export const wikiLinkPlugin = $prose(() => {
  return new Plugin({
    key: wikiLinkPluginKey,
    state: {
      init(_, { doc }) {
        return createWikiLinkDecorations(doc);
      },
      apply(tr, old) {
        if (tr.docChanged) {
          return createWikiLinkDecorations(tr.doc);
        }
        return old;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement;
        if (target.classList.contains('wiki-link')) {
          const linkText = target.getAttribute('data-link');
          if (linkText) {
            window.dispatchEvent(new CustomEvent('wiki-link-click', {
              detail: { linkText }
            }));
            return true;
          }
        }
        return false;
      },
    },
  });
});
