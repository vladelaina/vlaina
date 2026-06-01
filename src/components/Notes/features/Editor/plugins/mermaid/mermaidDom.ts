import DOMPurify from 'dompurify';
import { translate } from '@/lib/i18n';
import {
  normalizeMermaidCodeForRender,
  normalizeMermaidEditorCodeInput,
} from './mermaidFenceCode';
import { themeColorTokens } from '@/styles/themeTokens';

type MermaidRender = (code: string, id: string) => Promise<string>;

const mermaidElementCode = new WeakMap<HTMLElement, string>();
let mermaidRenderKeyCounter = 0;
let mermaidIdCounter = 0;
const MERMAID_RENDER_CACHE_LIMIT = 80;
const mermaidMarkupCache = new Map<string, string>();
const mermaidRenderPromiseCache = new Map<string, Promise<string>>();
const MERMAID_LAZY_RENDER_ROOT_MARGIN = '900px 0px';
const mermaidLazyObservers = new WeakMap<HTMLElement, IntersectionObserver>();

function generateMermaidId(): string {
  return `mermaid-${Date.now()}-${mermaidIdCounter++}`;
}

function mermaidRenderErrorMarkup(): string {
  return `<div class="mermaid-error">${translate('editor.mermaidRenderError')}</div>`;
}

function normalizeMermaidRenderMarkup(markup: string): string {
  return /class=(["'])error-(?:text|icon)\1/.test(markup) || markup.includes('Syntax error in text')
    ? mermaidRenderErrorMarkup()
    : markup;
}

async function defaultRenderMermaid(code: string, id: string) {
  const { renderMermaid } = await import('./mermaidRenderer');
  return renderMermaid(code, id);
}

function setMermaidElementCode(element: HTMLElement, code: string) {
  mermaidElementCode.set(element, code);
  element.dataset.renderKey = `mermaid-render-${mermaidRenderKeyCounter++}`;
  delete element.dataset.code;
  return element.dataset.renderKey;
}

export function getMermaidElementCode(element: HTMLElement) {
  return mermaidElementCode.get(element) ?? element.dataset.code ?? '';
}

function getMermaidRenderCode(sourceCode: string) {
  return normalizeMermaidCodeForRender(sourceCode);
}

async function renderMermaidHtml(
  code: string,
  render: MermaidRender
) {
  try {
    return normalizeMermaidRenderMarkup(await render(code, generateMermaidId()));
  } catch {
    return mermaidRenderErrorMarkup();
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

async function resolveMermaidMarkup(
  code: string,
  render?: MermaidRender
) {
  if (render) {
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

  const promise = renderMermaidHtml(code, defaultRenderMermaid)
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
    text.setAttribute('fill', themeColorTokens.mermaidText);

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
  render?: MermaidRender;
  onRendered?: () => void;
}) {
  const { anchor, code, render, onRendered } = args;
  if (!anchor) {
    return false;
  }
  disconnectLazyMermaidRender(anchor);

  const normalizedCode = normalizeMermaidEditorCodeInput(code);
  const renderCode = getMermaidRenderCode(normalizedCode);

  if (!normalizedCode.trim()) {
    setMermaidElementCode(anchor, normalizedCode);
    anchor.innerHTML = `<div class="mermaid-empty">${translate('editor.emptyDiagram')}</div>`;
    onRendered?.();
    return true;
  }

  const codeSnapshot = normalizedCode;
  const renderCodeSnapshot = renderCode;
  const renderKey = setMermaidElementCode(anchor, codeSnapshot);

  const cachedMarkup = render ? null : readCachedMermaidMarkup(renderCodeSnapshot);
  if (cachedMarkup != null) {
    anchor.innerHTML = cachedMarkup;
    onRendered?.();
    return true;
  }

  const markup = await resolveMermaidMarkup(renderCodeSnapshot, render);
  if (!anchor.isConnected || getMermaidElementCode(anchor) !== codeSnapshot || anchor.dataset.renderKey !== renderKey) {
    return false;
  }

  anchor.innerHTML = markup;
  onRendered?.();
  return true;
}

function shouldLazyRenderMermaidElement() {
  return typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined';
}

function disconnectLazyMermaidRender(anchor: HTMLElement) {
  mermaidLazyObservers.get(anchor)?.disconnect();
  mermaidLazyObservers.delete(anchor);
  delete anchor.dataset.mermaidLazy;
}

export function disposeMermaidElement(anchor: HTMLElement) {
  disconnectLazyMermaidRender(anchor);
}

function setMermaidPendingMarkup(anchor: HTMLElement) {
  anchor.innerHTML = '<div class="mermaid-placeholder" aria-hidden="true"></div>';
}

function renderMermaidElementAsync(anchor: HTMLElement, codeSnapshot: string, renderKey: string | undefined) {
  const renderCodeSnapshot = getMermaidRenderCode(codeSnapshot);
  resolveMermaidMarkup(renderCodeSnapshot).then((markup) => {
    if (
      getMermaidElementCode(anchor) !== codeSnapshot ||
      anchor.dataset.renderKey !== renderKey
    ) {
      return;
    }
    disconnectLazyMermaidRender(anchor);
    anchor.innerHTML = markup;
  });
}

function installLazyMermaidRender(anchor: HTMLElement, codeSnapshot: string, renderKey: string | undefined) {
  anchor.dataset.mermaidLazy = 'true';
  setMermaidPendingMarkup(anchor);

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) {
      return;
    }
    disconnectLazyMermaidRender(anchor);
    renderMermaidElementAsync(anchor, codeSnapshot, renderKey);
  }, { rootMargin: MERMAID_LAZY_RENDER_ROOT_MARGIN });
  mermaidLazyObservers.set(anchor, observer);
  observer.observe(anchor);
}

export function createMermaidElement(code: string) {
  const normalizedCode = normalizeMermaidEditorCodeInput(code);
  const renderCode = getMermaidRenderCode(normalizedCode);
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-type', 'mermaid');
  setMermaidElementCode(wrapper, normalizedCode);
  wrapper.className = 'mermaid-block';

  if (normalizedCode.trim()) {
    const cachedMarkup = readCachedMermaidMarkup(renderCode);
    if (cachedMarkup != null) {
      wrapper.innerHTML = cachedMarkup;
      return wrapper;
    }

    const codeSnapshot = normalizedCode;
    const renderKey = wrapper.dataset.renderKey;
    if (shouldLazyRenderMermaidElement()) {
      installLazyMermaidRender(wrapper, codeSnapshot, renderKey);
    } else {
      renderMermaidElementAsync(wrapper, codeSnapshot, renderKey);
    }
  } else {
    wrapper.innerHTML = `<div class="mermaid-empty">${translate('editor.emptyDiagram')}</div>`;
  }

  return wrapper;
}
