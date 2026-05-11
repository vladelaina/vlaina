import DOMPurify from 'dompurify';
import { generateMermaidId, renderMermaid } from './mermaidRenderer';
import { normalizeMermaidEditorCodeInput } from './mermaidFenceCode';

const mermaidElementCode = new WeakMap<HTMLElement, string>();
let mermaidRenderKeyCounter = 0;
const MERMAID_RENDER_CACHE_LIMIT = 80;
const MERMAID_RENDER_ERROR_HTML =
  '<div class="mermaid-error">Mermaid Error: Unable to render diagram. Check the diagram syntax.</div>';
const mermaidMarkupCache = new Map<string, string>();
const mermaidRenderPromiseCache = new Map<string, Promise<string>>();

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

function readCachedMermaidMarkup(code: string) {
  const cached = mermaidMarkupCache.get(code);
  if (cached == null) {
    return null;
  }

  mermaidMarkupCache.delete(code);
  mermaidMarkupCache.set(code, cached);
  return cached;
}

function cacheMermaidMarkup(code: string, markup: string) {
  mermaidMarkupCache.set(code, markup);
  while (mermaidMarkupCache.size > MERMAID_RENDER_CACHE_LIMIT) {
    const oldestKey = mermaidMarkupCache.keys().next().value;
    if (typeof oldestKey !== 'string') {
      break;
    }
    mermaidMarkupCache.delete(oldestKey);
  }
  return markup;
}

function shouldUseDefaultMermaidRender(render: (code: string, id: string) => Promise<string>) {
  return render === renderMermaid;
}

async function resolveMermaidMarkup(
  code: string,
  render: (code: string, id: string) => Promise<string>
) {
  if (!shouldUseDefaultMermaidRender(render)) {
    return sanitizeMermaidMarkup(await renderMermaidHtml(code, render));
  }

  const cached = readCachedMermaidMarkup(code);
  if (cached != null) {
    return cached;
  }

  const existingPromise = mermaidRenderPromiseCache.get(code);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = renderMermaidHtml(code, render)
    .then(sanitizeMermaidMarkup)
    .then((markup) => cacheMermaidMarkup(code, markup))
    .finally(() => {
      mermaidRenderPromiseCache.delete(code);
    });
  mermaidRenderPromiseCache.set(code, promise);
  return promise;
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

  const cachedMarkup = shouldUseDefaultMermaidRender(render)
    ? readCachedMermaidMarkup(codeSnapshot)
    : null;
  if (cachedMarkup != null) {
    anchor.innerHTML = cachedMarkup;
    onRendered?.();
    return true;
  }

  const markup = await resolveMermaidMarkup(codeSnapshot, render);
  if (!anchor.isConnected || getMermaidElementCode(anchor) !== codeSnapshot || anchor.dataset.renderKey !== renderKey) {
    return false;
  }

  anchor.innerHTML = markup;
  onRendered?.();
  return true;
}

export function createMermaidElement(code: string) {
  const normalizedCode = normalizeMermaidEditorCodeInput(code);
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-type', 'mermaid');
  setMermaidElementCode(wrapper, normalizedCode);
  wrapper.className = 'mermaid-block';

  if (normalizedCode.trim()) {
    const cachedMarkup = readCachedMermaidMarkup(normalizedCode);
    if (cachedMarkup != null) {
      wrapper.innerHTML = cachedMarkup;
      return wrapper;
    }

    const codeSnapshot = normalizedCode;
    const renderKey = wrapper.dataset.renderKey;
    resolveMermaidMarkup(codeSnapshot, renderMermaid).then((markup) => {
      if (getMermaidElementCode(wrapper) !== codeSnapshot || wrapper.dataset.renderKey !== renderKey) {
        return;
      }
      wrapper.innerHTML = markup;
    });
  } else {
    wrapper.innerHTML = '<div class="mermaid-empty">Empty diagram</div>';
  }

  return wrapper;
}
