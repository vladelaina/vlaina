import DOMPurify from 'dompurify';
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

function sanitizeMermaidMarkup(markup: string) {
  return DOMPurify.sanitize(replaceMermaidForeignObjectLabels(markup), {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'object', 'embed'],
  });
}

function replaceMermaidForeignObjectLabels(markup: string) {
  if (!markup.includes('<foreignObject')) {
    return markup;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    return markup;
  }

  doc.querySelectorAll('foreignObject').forEach((foreignObject) => {
    foreignObject.querySelectorAll('script, style').forEach((node) => node.remove());
    const labelElement = foreignObject.querySelector('.nodeLabel');
    const lines = extractMermaidLabelLines(labelElement);
    if (lines.length === 0) {
      foreignObject.remove();
      return;
    }

    const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'nodeLabel');
    text.setAttribute('x', resolveForeignObjectCenterCoord(foreignObject, 'x', 'width'));
    text.setAttribute('y', resolveForeignObjectCenterCoord(foreignObject, 'y', 'height'));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#27272A');

    const firstLineDy = lines.length > 1
      ? `${0.35 - ((lines.length - 1) * 0.6)}em`
      : '0.35em';
    lines.forEach((line, index) => {
      const tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.setAttribute('x', text.getAttribute('x') || '0');
      tspan.setAttribute('dy', index === 0 ? firstLineDy : '1.2em');
      tspan.textContent = line;
      text.appendChild(tspan);
    });

    foreignObject.replaceWith(text);
  });

  return new XMLSerializer().serializeToString(doc.documentElement);
}

function extractMermaidLabelLines(labelElement: Element | null) {
  if (!labelElement) {
    return [];
  }

  const paragraphs = Array.from(labelElement.querySelectorAll('p'))
    .flatMap(extractElementTextLines)
    .filter((line) => line.length > 0);
  if (paragraphs.length > 0) {
    return paragraphs;
  }

  return extractElementTextLines(labelElement);
}

function extractElementTextLines(element: Element) {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith(clone.ownerDocument.createTextNode('\n'));
  });
  return (clone.textContent || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function resolveForeignObjectCenterCoord(
  foreignObject: Element,
  startAttr: 'x' | 'y',
  sizeAttr: 'width' | 'height'
) {
  const start = Number.parseFloat(foreignObject.getAttribute(startAttr) || '0');
  const size = Number.parseFloat(foreignObject.getAttribute(sizeAttr) || '0');
  const center = start + (Number.isFinite(size) ? size / 2 : 0);
  return Number.isFinite(center) ? String(center) : '0';
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

  anchor.innerHTML = sanitizeMermaidMarkup(svg);
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
      wrapper.innerHTML = sanitizeMermaidMarkup(svg);
    });
  } else {
    wrapper.innerHTML = '<div class="mermaid-empty">Empty diagram</div>';
  }

  return wrapper;
}
