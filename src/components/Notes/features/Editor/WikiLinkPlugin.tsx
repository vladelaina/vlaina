/**
 * WikiLinkPlugin - Obsidian-style [[wiki links]] support
 * 
 * Features:
 * - Parse [[note]] syntax
 * - Auto-complete when typing [[
 * - Click to navigate to linked note
 * - Create new note if link target doesn't exist
 */

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
            // Dispatch custom event for navigation
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

/**
 * Extract all wiki links from markdown content
 */
export function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  let match;
  
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    links.push(match[1]);
  }
  
  return [...new Set(links)]; // Remove duplicates
}

/**
 * Find all notes that link to a specific note (backlinks)
 */
export function findBacklinks(
  targetNoteName: string,
  allNotes: { path: string; content: string }[]
): string[] {
  const backlinks: string[] = [];
  
  for (const note of allNotes) {
    const links = extractWikiLinks(note.content);
    if (links.some(link => 
      link.toLowerCase() === targetNoteName.toLowerCase() ||
      link.toLowerCase() === targetNoteName.replace('.md', '').toLowerCase()
    )) {
      backlinks.push(note.path);
    }
  }
  
  return backlinks;
}
