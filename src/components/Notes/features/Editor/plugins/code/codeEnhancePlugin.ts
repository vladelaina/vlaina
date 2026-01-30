// Code block enhancement plugin
// Adds: line numbers and syntax highlighting only.
// REMOVED: Duplicate Copy Button & Toolbar (handled by React View now)

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { highlightCode } from '../../utils/shiki';

export const codeEnhancePluginKey = new PluginKey('codeEnhance');

interface CodeBlockInfo {
  pos: number;
  node: any;
  language: string | null;
  code: string;
  lineNumbers: boolean;
  highlightLines: number[];
}

/**
 * Parse line highlight syntax: ```js {1,3-5}
 */
function parseHighlightLines(meta: string | null): number[] {
  if (!meta) return [];
  
  const match = meta.match(/\{([^}]+)\}/);
  if (!match) return [];
  
  const lines: number[] = [];
  const parts = match[1].split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(n => parseInt(n, 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          lines.push(i);
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        lines.push(num);
      }
    }
  }
  
  return lines;
}

/**
 * Find all code blocks in document
 */
function findCodeBlocks(doc: any): CodeBlockInfo[] {
  const blocks: CodeBlockInfo[] = [];
  
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'code_block') {
      blocks.push({
        pos,
        node,
        language: node.attrs.language || null,
        code: node.textContent,
        lineNumbers: node.attrs.lineNumbers !== false,
        highlightLines: parseHighlightLines(node.attrs.meta)
      });
    }
  });
  
  return blocks;
}

/**
 * Create enhanced code block widget
 * (Purely for visual decoration: line numbers & highlighting underlay)
 */
function createCodeBlockWidget(info: CodeBlockInfo): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block-enhanced';
  wrapper.setAttribute('data-language', info.language || '');
  
  // -- REMOVED: Duplicate JS-based Toolbar & Copy Button --
  // The React Header (CodeBlockView.tsx) now handles all interaction.
  
  // Code content container
  const content = document.createElement('div');
  content.className = 'code-block-content';
  
  // 1. Line Numbers
  if (info.lineNumbers) {
    const lines = info.code.split('\n');
    const lineNumbersEl = document.createElement('div');
    lineNumbersEl.className = 'code-block-line-numbers';
    lineNumbersEl.contentEditable = 'false';
    
    lines.forEach((_, i) => {
      const lineNum = document.createElement('span');
      lineNum.textContent = String(i + 1);
      if (info.highlightLines.includes(i + 1)) {
        lineNum.className = 'highlighted';
      }
      lineNumbersEl.appendChild(lineNum);
    });
    
    content.appendChild(lineNumbersEl);
  }
  
  // 2. Syntax Highlighting (Visual Underlay)
  const codeEl = document.createElement('div');
  codeEl.className = 'code-block-code';
  
  // Apply syntax highlighting asynchronously
  highlightCode(info.code, info.language).then((html) => {
    codeEl.innerHTML = html;
    
    // Apply line highlighting
    if (info.highlightLines.length > 0) {
      const codeLines = codeEl.querySelectorAll('.line');
      codeLines.forEach((line, i) => {
        if (info.highlightLines.includes(i + 1)) {
          line.classList.add('highlighted');
        }
      });
    }
  }).catch(() => {
    codeEl.textContent = info.code;
  });
  
  content.appendChild(codeEl);
  wrapper.appendChild(content);
  
  return wrapper;
}

/**
 * Create decorations for code blocks
 */
function createCodeDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  const blocks = findCodeBlocks(doc);
  
  for (const block of blocks) {
    // Add widget decoration before the code block
    // Using side: -1 to ensure it sits 'behind' or 'before' the editable content in ProseMirror structure logic
    // But in CSS grid/stacking, we will layer them.
    const widget = Decoration.widget(block.pos, () => {
      return createCodeBlockWidget(block);
    }, {
      side: -1,
      key: `code-enhance-${block.pos}`
    });
    
    decorations.push(widget);
  }
  
  return DecorationSet.create(doc, decorations);
}

/**
 * Code enhancement plugin
 */
export const codeEnhancePlugin = $prose(() => {
  return new Plugin({
    key: codeEnhancePluginKey,
    state: {
      init(_, { doc }) {
        return createCodeDecorations(doc);
      },
      apply(tr, old) {
        if (tr.docChanged) {
          // For small changes, use mapping to avoid full rebuild
          if (tr.steps.length <= 2) {
            return old.map(tr.mapping, tr.doc);
          }
          return createCodeDecorations(tr.doc);
        }
        return old;
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      }
    }
  });
});
