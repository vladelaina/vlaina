import { sanitizeMermaidMarkup } from '@/components/common/markdown/mermaidSanitizer';
import { translate } from '@/lib/i18n';
import {
  normalizeMermaidCodeForRender,
  normalizeMermaidEditorCodeInput,
} from './mermaidFenceCode';
import { themeLazyLoadTokens } from '@/styles/themeTokens';

type MermaidRender = (code: string, id: string) => Promise<string>;

const mermaidElementCode = new WeakMap<HTMLElement, string>();
let mermaidRenderKeyCounter = 0;
let mermaidIdCounter = 0;
const MERMAID_RENDER_CACHE_LIMIT = 80;
export const MAX_PENDING_MERMAID_RENDERS = 80;
const mermaidMarkupCache = new Map<string, string>();
const mermaidRenderPromiseCache = new Map<string, Promise<string>>();
const mermaidLazyObservers = new WeakMap<HTMLElement, IntersectionObserver>();
const disposedMermaidElements = new WeakSet<HTMLElement>();
const MAX_MERMAID_RENDER_CODE_CHARS = 20_000;
export const MAX_LEGACY_MERMAID_DATA_CODE_CHARS = 100_000;

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateMermaidId(): string {
  return `mermaid-${Date.now()}-${mermaidIdCounter++}`;
}

function mermaidRenderErrorMarkup(): string {
  return `<div class="mermaid-error">${escapeHtmlText(translate('editor.mermaidRenderError'))}</div>`;
}

function mermaidRenderTooLargeMarkup(): string {
  return `<div class="mermaid-error">${escapeHtmlText(translate('editor.mermaidRenderTooLarge'))}</div>`;
}

function mermaidEmptyMarkup(): string {
  return '<div class="mermaid-empty" aria-hidden="true">\u200b</div>';
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
  disposedMermaidElements.delete(element);
  mermaidElementCode.set(element, code);
  element.dataset.renderKey = `mermaid-render-${mermaidRenderKeyCounter++}`;
  delete element.dataset.code;
  return element.dataset.renderKey;
}

export function getMermaidElementCode(element: HTMLElement) {
  const code = mermaidElementCode.get(element);
  if (code != null) return code;

  const legacyCode = element.dataset.code ?? '';
  return legacyCode.length > MAX_LEGACY_MERMAID_DATA_CODE_CHARS
    ? legacyCode.slice(0, MAX_LEGACY_MERMAID_DATA_CODE_CHARS)
    : legacyCode;
}

function getMermaidRenderCode(sourceCode: string) {
  return normalizeMermaidCodeForRender(sourceCode);
}

function isMermaidRenderCodeTooLarge(code: string) {
  return code.length > MAX_MERMAID_RENDER_CODE_CHARS;
}

function isLikelyIncompleteMermaidRenderCode(code: string) {
  const closingStack: string[] = [];
  let quotedBy: string | null = null;
  let escaped = false;

  for (const char of code) {
    if (quotedBy) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quotedBy) {
        quotedBy = null;
      }
      continue;
    }

    if (char === '"' || char === '`') {
      quotedBy = char;
      continue;
    }

    if (char === '{') {
      closingStack.push('}');
    } else if (char === '[') {
      closingStack.push(']');
    } else if (char === '(') {
      closingStack.push(')');
    } else if (closingStack[closingStack.length - 1] === char) {
      closingStack.pop();
    }
  }

  return quotedBy !== null || closingStack.length > 0;
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

export function clearMermaidRenderCaches(): void {
  mermaidMarkupCache.clear();
  mermaidRenderPromiseCache.clear();
}

export function getPendingMermaidRenderCount(): number {
  return mermaidRenderPromiseCache.size;
}

export async function resolveMermaidMarkup(
  code: string,
  render?: MermaidRender
) {
  if (isMermaidRenderCodeTooLarge(code)) {
    return sanitizeMermaidMarkup(mermaidRenderTooLargeMarkup());
  }
  if (isLikelyIncompleteMermaidRenderCode(code)) {
    return sanitizeMermaidMarkup(mermaidRenderErrorMarkup());
  }

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
  if (mermaidRenderPromiseCache.size >= MAX_PENDING_MERMAID_RENDERS) {
    return sanitizeMermaidMarkup(mermaidRenderErrorMarkup());
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
    anchor.innerHTML = mermaidEmptyMarkup();
    onRendered?.();
    return true;
  }

  const codeSnapshot = normalizedCode;
  const renderCodeSnapshot = renderCode;
  const renderKey = setMermaidElementCode(anchor, codeSnapshot);

  if (isMermaidRenderCodeTooLarge(renderCodeSnapshot)) {
    anchor.innerHTML = sanitizeMermaidMarkup(mermaidRenderTooLargeMarkup());
    onRendered?.();
    return true;
  }
  if (isLikelyIncompleteMermaidRenderCode(renderCodeSnapshot)) {
    anchor.innerHTML = sanitizeMermaidMarkup(mermaidRenderErrorMarkup());
    onRendered?.();
    return true;
  }

  const cachedMarkup = render ? null : readCachedMermaidMarkup(renderCodeSnapshot);
  if (cachedMarkup != null) {
    anchor.innerHTML = cachedMarkup;
    onRendered?.();
    return true;
  }

  const markup = await resolveMermaidMarkup(renderCodeSnapshot, render);
  if (
    disposedMermaidElements.has(anchor) ||
    !anchor.isConnected ||
    getMermaidElementCode(anchor) !== codeSnapshot ||
    anchor.dataset.renderKey !== renderKey
  ) {
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
  disposedMermaidElements.add(anchor);
  disconnectLazyMermaidRender(anchor);
}

function setMermaidPendingMarkup(anchor: HTMLElement) {
  anchor.innerHTML = '<div class="mermaid-placeholder" aria-hidden="true"></div>';
}

function renderMermaidElementAsync(anchor: HTMLElement, codeSnapshot: string, renderKey: string | undefined) {
  const renderCodeSnapshot = getMermaidRenderCode(codeSnapshot);
  resolveMermaidMarkup(renderCodeSnapshot).then((markup) => {
    if (
      disposedMermaidElements.has(anchor) ||
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
  }, { rootMargin: themeLazyLoadTokens.mermaidRootMargin });
  mermaidLazyObservers.set(anchor, observer);
  observer.observe(anchor);
}

export function createMermaidElement(code: string) {
  const normalizedCode = normalizeMermaidEditorCodeInput(code);
  const renderCode = getMermaidRenderCode(normalizedCode);
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-type', 'mermaid');
  setMermaidElementCode(wrapper, normalizedCode);
  wrapper.className = 'mermaid-block theme-mermaid md-fences md-diagram md-fences-advanced md-diagram-panel md-diagram-panel-preview';

  if (normalizedCode.trim()) {
    if (isMermaidRenderCodeTooLarge(renderCode)) {
      wrapper.innerHTML = sanitizeMermaidMarkup(mermaidRenderTooLargeMarkup());
      return wrapper;
    }

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
    wrapper.innerHTML = mermaidEmptyMarkup();
  }

  return wrapper;
}
