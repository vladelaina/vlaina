import { generateMermaidId, renderMermaid } from './mermaidRenderer';
import { normalizeMermaidEditorCodeInput } from './mermaidFenceCode';

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
    anchor.dataset.code = normalizedCode;
    anchor.innerHTML = '<div class="mermaid-empty">Empty diagram</div>';
    onRendered?.();
    return true;
  }

  const codeSnapshot = normalizedCode;
  anchor.dataset.code = codeSnapshot;

  if (!anchor.querySelector('svg, .mermaid-error')) {
    anchor.innerHTML = '<div class="mermaid-placeholder">Rendering diagram...</div>';
  }

  const svg = await render(codeSnapshot, generateMermaidId());
  if (!anchor.isConnected || anchor.dataset.code !== codeSnapshot) {
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
  wrapper.setAttribute('data-code', normalizedCode);
  wrapper.className = 'mermaid-block';

  const placeholder = document.createElement('div');
  placeholder.className = 'mermaid-placeholder';
  placeholder.textContent = 'Loading diagram...';
  wrapper.appendChild(placeholder);

  if (normalizedCode.trim()) {
    const codeSnapshot = normalizedCode;
    renderMermaid(codeSnapshot, generateMermaidId()).then((svg) => {
      if (!wrapper.isConnected || wrapper.dataset.code !== codeSnapshot) {
        return;
      }
      wrapper.innerHTML = svg;
    });
  } else {
    wrapper.innerHTML = '<div class="mermaid-empty">Empty diagram</div>';
  }

  return wrapper;
}
