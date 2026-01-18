// Autolink plugin for automatic URL detection
// Converts plain URLs like www.example.com to clickable links

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

// URL patterns to match (Strict Whitelist Approach)
const URL_PATTERNS = [
  // Full URLs with protocol
  /https?:\/\/[\w\-\._~:/?#[\]@!$&'*+,;=%()]+/g,
  // URLs starting with www.
  /www\.[\w\-\._~:/?#[\]@!$&'*+,;=%()]+/g,
  // Email addresses
  /[\w\-\._%+-]+@[\w\-\._]+\.[a-zA-Z]{2,}/g
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
        // Optimization removed: We need to check every change because:
        // 1. Typing a URL char-by-char needs to extend the link
        // 2. Typing a space needs to terminate the link (re-run regex to exclude space)
        // The previous check (text.includes('http')) failed these cases.
        // if (tr.steps.length <= 2) { ... }

        return createAutolinkDecorations(tr.doc);
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
      handleTextInput(view, from, to, text) {
        // LINK BREAKER: If user types a space at the end of a link, break out of the link mark.
        // This prevents "greedy links" that eat the space and following text.
        if (text === ' ') {
          const { state } = view;
          const { selection } = state;
          const $pos = selection.$from;

          // Check if we are inside a link mark
          const hasLink = $pos.marks().some(m => m.type.name === 'link');

          // And if we are at the end of that mark (or simply inside one, we want space to break it)
          if (hasLink) {
            // Dispatch a transaction that inserts the space WITHOUT the link mark
            // This effectively "turns off" the link for future typing
            const tr = state.tr.insertText(text, from, to);
            tr.removeStoredMark(state.schema.marks.link);
            view.dispatch(tr);
            return true; // We handled the input
          }
        }
        return false;
      },
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement;
        if (target.classList.contains('autolink')) {
          // APPLE DESIGN UX: In an editor, "Click" is for editing (placing cursor).
          // "Action" (opening link) requires intent via Modifier Key (Ctrl/Cmd).
          // This prevents jarring context switches when user just wants to fix a typo.
          if (!event.ctrlKey && !event.metaKey) {
            return false; // Let ProseMirror handle the click (place cursor)
          }

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
