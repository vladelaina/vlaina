import { generateMermaidId, renderMermaid } from './mermaidRenderer';
import { normalizeMermaidEditorCodeInput } from './mermaidFenceCode';

const mermaidElementCode = new WeakMap<HTMLElement, string>();
let mermaidRenderKeyCounter = 0;
const MERMAID_RENDER_ERROR_HTML =
  '<div class="mermaid-error">Mermaid Error: Unable to render diagram. Check the diagram syntax.</div>';

function setMermaidElementCode(element: HTMLElement, code: string) {
  mermaidElementCode.set(element, code);
  element.dataset.renderKey = `mermaid-render-${mermaidRenderKeyCounter++}`;
  delete element.dataset.code;
  return element.dataset.renderKey;
}

export function getMermaidElementCode(element: HTMLElement) {
  return mermaidElementCode.get(element) ?? element.dataset.code ?? '';
}

async function renderMermaidHtml(
  code: string,
  render: (code: string, id: string) => Promise<string>
) {
  try {
    return await render(code, generateMermaidId());
  } catch {
    return MERMAID_RENDER_ERROR_HTML;
  }
}

export async function renderMermaidEditorLivePreview(args: {
  anchor: HTMLElement | null;
  code: string;
  render?: (code: string, id: string) => Promise<string>;
  onRendered?: () => void;
}) {
  const { anchor, code, render = renderMermaid, onRendered } = args;
  if (!anchor) {
    return false;
  }

  const normalizedCode = normalizeMermaidEditorCodeInput(code);

  if (!normalizedCode.trim()) {
    setMermaidElementCode(anchor, normalizedCode);
    anchor.innerHTML = '<div class="mermaid-empty">Empty diagram</div>';
    onRendered?.();
    return true;
  }

  const codeSnapshot = normalizedCode;
  const renderKey = setMermaidElementCode(anchor, codeSnapshot);

  if (!anchor.querySelector('svg, .mermaid-error')) {
    anchor.innerHTML = '<div class="mermaid-placeholder">Rendering diagram...</div>';
  }

  const svg = await renderMermaidHtml(codeSnapshot, render);
  if (!anchor.isConnected || getMermaidElementCode(anchor) !== codeSnapshot || anchor.dataset.renderKey !== renderKey) {
    return false;
  }

  anchor.innerHTML = svg;
  onRendered?.();
  return true;
}

export function createMermaidElement(code: string) {
  const normalizedCode = normalizeMermaidEditorCodeInput(code);
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-type', 'mermaid');
  setMermaidElementCode(wrapper, normalizedCode);
  wrapper.className = 'mermaid-block';

  const placeholder = document.createElement('div');
  placeholder.className = 'mermaid-placeholder';
  placeholder.textContent = 'Loading diagram...';
  wrapper.appendChild(placeholder);

  if (normalizedCode.trim()) {
    const codeSnapshot = normalizedCode;
    const renderKey = wrapper.dataset.renderKey;
    renderMermaidHtml(codeSnapshot, renderMermaid).then((svg) => {
      if (getMermaidElementCode(wrapper) !== codeSnapshot || wrapper.dataset.renderKey !== renderKey) {
        return;
      }
      wrapper.innerHTML = svg;
    });
  } else {
    wrapper.innerHTML = '<div class="mermaid-empty">Empty diagram</div>';
  }

  return wrapper;
}
