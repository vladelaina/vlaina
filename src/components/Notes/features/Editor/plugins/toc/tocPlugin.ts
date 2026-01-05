// TOC (Table of Contents) plugin
// Supports: [TOC] syntax to generate table of contents

import { $node, $command, $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { TocAttrs, TocItem } from './types';

const tocViewPluginKey = new PluginKey('tocView');

/**
 * Extract headings from document
 */
function extractHeadings(doc: any, maxLevel: number = 6): TocItem[] {
  const headings: TocItem[] = [];
  let counter = 0;
  
  doc.descendants((node: any) => {
    if (node.type.name === 'heading') {
      const level = node.attrs.level as number;
      if (level <= maxLevel) {
        const text = node.textContent;
        const id = `heading-${counter++}`;
        headings.push({ level, text, id });
      }
    }
  });
  
  return headings;
}

/**
 * Generate TOC HTML
 */
function generateTocHtml(headings: TocItem[]): string {
  if (headings.length === 0) {
    return '<div class="toc-empty">No headings found</div>';
  }
  
  let html = '<nav class="toc-nav"><ul class="toc-list">';
  
  for (const heading of headings) {
    const indent = (heading.level - 1) * 16;
    html += `<li class="toc-item toc-level-${heading.level}" style="padding-left: ${indent}px">`;
    html += `<a href="#${heading.id}" class="toc-link">${escapeHtml(heading.text)}</a>`;
    html += '</li>';
  }
  
  html += '</ul></nav>';
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// TOC view plugin - updates TOC content when document changes
export const tocViewPlugin = $prose(() => {
  return new Plugin({
    key: tocViewPluginKey,
    view() {
      return {
        update(view) {
          const { doc } = view.state;
          
          // Find all TOC blocks and update their content
          const tocElements = document.querySelectorAll('.toc-block');
          tocElements.forEach((el) => {
            const maxLevel = parseInt(el.getAttribute('data-max-level') || '6', 10);
            const headings = extractHeadings(doc, maxLevel);
            const contentEl = el.querySelector('.toc-content');
            if (contentEl) {
              contentEl.innerHTML = generateTocHtml(headings);
            }
          });
        }
      };
    }
  });
});

// TOC node schema
export const tocSchema = $node('toc', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  attrs: {
    maxLevel: { default: 6 }
  },
  parseDOM: [{
    tag: 'div[data-type="toc"]',
    getAttrs: (dom) => ({
      maxLevel: parseInt((dom as HTMLElement).dataset.maxLevel || '6', 10)
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as TocAttrs;
    // Note: Actual TOC content is generated dynamically via nodeView
    return [
      'div',
      {
        'data-type': 'toc',
        'data-max-level': String(attrs.maxLevel),
        class: 'toc-block'
      },
      ['div', { class: 'toc-title' }, '📑 Table of Contents'],
      ['div', { class: 'toc-content' }, '[TOC will be generated here]']
    ];
  },
  parseMarkdown: {
    match: (node) => {
      // Match [TOC] or [toc] in paragraph
      if (node.type === 'paragraph') {
        const children = node.children as Array<{ type: string; value?: string }> | undefined;
        if (children?.length === 1 && children[0].type === 'text') {
          const text = children[0].value || '';
          return /^\[toc\]$/i.test(text.trim());
        }
      }
      return false;
    },
    runner: (state, _node, type) => {
      state.addNode(type, { maxLevel: 6 });
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'toc',
    runner: (state) => {
      state.addNode('paragraph', undefined, undefined, {
        children: [{ type: 'text', value: '[TOC]' }]
      });
    }
  }
}));

// Insert TOC command
export const insertTocCommand = $command('insertToc', () => () => {
  return (state, dispatch) => {
    const { schema } = state;
    const tocType = schema.nodes.toc;
    
    if (!tocType) return false;
    
    if (dispatch) {
      const node = tocType.create({ maxLevel: 6 });
      const tr = state.tr.replaceSelectionWith(node);
      dispatch(tr.scrollIntoView());
    }
    
    return true;
  };
});

// Combined TOC plugin
export const tocPlugin = [
  tocSchema,
  insertTocCommand,
  tocViewPlugin
];
