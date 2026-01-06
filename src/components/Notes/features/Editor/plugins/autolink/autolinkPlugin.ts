// Autolink plugin for automatic URL detection
// Converts plain URLs like www.example.com to clickable links

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

// URL patterns to match
const URL_PATTERNS = [
  // Full URLs with protocol
  /https?:\/\/[^\s<>[\](){}'"]+/g,
  // URLs starting with www.
  /www\.[^\s<>[\](){}'"]+/g,
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
];

export const autolinkPluginKey = new PluginKey('autolink');

interface LinkMatch {
  start: number;
  end: number;
  url: string;
  href: string;
}

/**
 * Find all URL matches in text
 */
function findUrls(text: string, offset: number): LinkMatch[] {
  const matches: LinkMatch[] = [];
  
  for (const pattern of URL_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      let url = match[0];
      let href = url;
      
      // Clean up trailing punctuation
      const trailingPunct = /[.,;:!?)]+$/;
      const trailingMatch = url.match(trailingPunct);
      if (trailingMatch) {
        url = url.slice(0, -trailingMatch[0].length);
        href = url;
      }
      
      // Add protocol if missing
      if (url.startsWith('www.')) {
        href = 'https://' + url;
      } else if (url.includes('@') && !url.startsWith('mailto:')) {
        href = 'mailto:' + url;
      }
      
      matches.push({
        start: offset + match.index,
        end: offset + match.index + url.length,
        url,
        href
      });
    }
  }
  
  return matches;
}

/**
 * Creates decorations for auto-detected links
 */
function createAutolinkDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = node.text || '';
      const matches = findUrls(text, pos);
      
      for (const match of matches) {
        // Check if already inside a link mark
        const $pos = doc.resolve(match.start);
        const marks = $pos.marks();
        const hasLinkMark = marks.some((m: any) => m.type.name === 'link');
        
        if (!hasLinkMark) {
          decorations.push(
            Decoration.inline(match.start, match.end, {
              class: 'autolink',
              'data-href': match.href,
              nodeName: 'a',
              href: match.href,
              target: '_blank',
              rel: 'noopener noreferrer'
            })
          );
        }
      }
    }
  });
  
  return DecorationSet.create(doc, decorations);
}

/**
 * Milkdown plugin for automatic link detection
 */
export const autolinkPlugin = $prose(() => {
  return new Plugin({
    key: autolinkPluginKey,
    state: {
      init(_, { doc }) {
        return createAutolinkDecorations(doc);
      },
      apply(tr, old) {
        if (!tr.docChanged) {
          return old;
        }
        
        // For small changes, try mapping first
        if (tr.steps.length <= 2) {
          const mapped = old.map(tr.mapping, tr.doc);
          
          // Check if the changed region contains URL-like patterns
          // Only rebuild if we detect potential new URLs in changed text
          let needsRebuild = false;
          tr.steps.forEach((step: any) => {
            if (step.slice?.content) {
              step.slice.content.forEach((node: any) => {
                if (node.isText && node.text) {
                  const text = node.text;
                  if (text.includes('http') || text.includes('www.') || text.includes('@')) {
                    needsRebuild = true;
                  }
                }
              });
            }
          });
          
          if (!needsRebuild) {
            return mapped;
          }
        }
        
        return createAutolinkDecorations(tr.doc);
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement;
        if (target.classList.contains('autolink')) {
          const href = target.getAttribute('data-href') || target.getAttribute('href');
          if (href) {
            window.open(href, '_blank', 'noopener,noreferrer');
            return true;
          }
        }
        return false;
      }
    }
  });
});
