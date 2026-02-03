import { $node } from '@milkdown/kit/utils';
import type { MermaidAttrs } from './types';

let mermaidInstance: any = null;
let mermaidPromise: Promise<any> | null = null;
let mermaidAvailable = true;

async function getMermaid() {
  if (!mermaidAvailable) return null;
  if (mermaidInstance) return mermaidInstance;
  
  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      try {
        const m = await import('mermaid');
        mermaidInstance = m.default;
        mermaidInstance.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit'
        });
        return mermaidInstance;
      } catch {
        mermaidAvailable = false;
        return null;
      }
    })();
  }
  
  return mermaidPromise;
}

async function renderMermaid(code: string, id: string): Promise<string> {
  const mermaid = await getMermaid();
  
  if (!mermaid) {
    return `<div class="mermaid-error">Mermaid not available. Install with: pnpm add mermaid</div>`;
  }
  
  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `<div class="mermaid-error">Mermaid Error: ${escapeHtml(message)}</div>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let mermaidCounter = 0;
function generateMermaidId(): string {
  return `mermaid-${Date.now()}-${mermaidCounter++}`;
}

export const mermaidSchema = $node('mermaid', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  marks: '',
  attrs: {
    code: { default: '' }
  },
  parseDOM: [{
    tag: 'div[data-type="mermaid"]',
    getAttrs: (dom) => ({
      code: (dom as HTMLElement).dataset.code || ''
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as MermaidAttrs;
    const id = generateMermaidId();
    
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-type', 'mermaid');
    wrapper.setAttribute('data-code', attrs.code);
    wrapper.className = 'mermaid-block';
    
    // Create placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'mermaid-placeholder';
    placeholder.textContent = 'Loading diagram...';
    wrapper.appendChild(placeholder);
    
    if (attrs.code) {
      renderMermaid(attrs.code, id).then((svg) => {
        wrapper.innerHTML = svg;
      });
    } else {
      wrapper.innerHTML = '<div class="mermaid-empty">Empty diagram</div>';
    }
    
    return wrapper;
  },
  parseMarkdown: {
    match: (node) => {
      return node.type === 'code' && node.lang === 'mermaid';
    },
    runner: (state, node, type) => {
      const code = (node.value as string) || '';
      state.addNode(type, { code });
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'mermaid',
    runner: (state, node) => {
      state.addNode('code', undefined, node.attrs.code, {
        lang: 'mermaid'
      });
    }
  }
}));

export const mermaidPlugin = [
  mermaidSchema
];