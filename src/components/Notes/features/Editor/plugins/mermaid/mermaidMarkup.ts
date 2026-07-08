import { sanitizeMermaidMarkup } from '@/components/common/markdown/mermaidSanitizer';
import {
  getFirstMermaidDirective,
  getMermaidCodeForLooseSyntaxScan,
} from '@/components/common/markdown/mermaidDirective';
import { translate } from '@/lib/i18n';
import { getEffectiveAppLanguage } from '@/lib/i18n/languages';
import { normalizeMermaidCodeForRender } from './mermaidFenceCode';
import { useUIStore } from '@/stores/uiSlice';

export type MermaidRender = (code: string, id: string) => Promise<string>;

let mermaidIdCounter = 0;
const MERMAID_RENDER_CACHE_LIMIT = 80;
export const MAX_PENDING_MERMAID_RENDERS = 80;
const mermaidMarkupCache = new Map<string, string>();
const mermaidRenderPromiseCache = new Map<string, Promise<string>>();
const MAX_MERMAID_RENDER_CODE_CHARS = 20_000;

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

function getMermaidMarkupCacheKey(code: string) {
  const language = getEffectiveAppLanguage(useUIStore.getState().languagePreference);
  return `${language}\0${code}`;
}

export function mermaidRenderErrorMarkup(): string {
  return `<div class="mermaid-error">${escapeHtmlText(translate('editor.mermaidRenderError'))}</div>`;
}

export function mermaidRenderTooLargeMarkup(): string {
  return `<div class="mermaid-error">${escapeHtmlText(translate('editor.mermaidRenderTooLarge'))}</div>`;
}

export function mermaidEmptyMarkup(): string {
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

export function getMermaidRenderCode(sourceCode: string) {
  return normalizeMermaidCodeForRender(sourceCode);
}

export function isMermaidRenderCodeTooLarge(code: string) {
  return code.length > MAX_MERMAID_RENDER_CODE_CHARS;
}

export function isLikelyIncompleteMermaidRenderCode(code: string) {
  const closingStack: string[] = [];
  let quotedBy: string | null = null;
  let escaped = false;
  const shouldTrackBracketPairs = getFirstMermaidDirective(code) !== 'erdiagram';
  const syntaxCode = getMermaidCodeForLooseSyntaxScan(code);

  for (const char of syntaxCode) {
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

    if (!shouldTrackBracketPairs) {
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

function readCachedMermaidMarkupByKey(cacheKey: string) {
  const cached = mermaidMarkupCache.get(cacheKey);
  if (cached == null) {
    return null;
  }

  mermaidMarkupCache.delete(cacheKey);
  mermaidMarkupCache.set(cacheKey, cached);
  return cached;
}

export function readCachedMermaidMarkup(code: string) {
  return readCachedMermaidMarkupByKey(getMermaidMarkupCacheKey(code));
}

function cacheMermaidMarkup(cacheKey: string, markup: string) {
  mermaidMarkupCache.set(cacheKey, markup);
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

  const cacheKey = getMermaidMarkupCacheKey(code);
  const cached = readCachedMermaidMarkupByKey(cacheKey);
  if (cached != null) {
    return cached;
  }

  const existingPromise = mermaidRenderPromiseCache.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }
  if (mermaidRenderPromiseCache.size >= MAX_PENDING_MERMAID_RENDERS) {
    return sanitizeMermaidMarkup(mermaidRenderErrorMarkup());
  }

  const promise = renderMermaidHtml(code, defaultRenderMermaid)
    .then(sanitizeMermaidMarkup)
    .then((markup) => cacheMermaidMarkup(cacheKey, markup))
    .finally(() => {
      mermaidRenderPromiseCache.delete(cacheKey);
    });
  mermaidRenderPromiseCache.set(cacheKey, promise);
  return promise;
}
