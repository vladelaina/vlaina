import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  generateMermaidId,
  MAX_MERMAID_CODE_CHARS,
  mermaidRenderErrorMarkup,
  renderMermaid as renderMermaidMarkup,
} from './mermaidRenderer';
import { getMermaidDiagramType } from './mermaidDiagramType';
import { sanitizeMermaidMarkup } from './mermaidSanitizer';

const READONLY_MERMAID_RENDER_CACHE_LIMIT = 80;
export const MAX_PENDING_READONLY_MERMAID_RENDERS = 80;
const readOnlyMermaidMarkupCache = new Map<string, string>();
const readOnlyMermaidRenderPromiseCache = new Map<string, Promise<string>>();

function getReadOnlyMermaidCacheKey(code: string, language: string) {
  return `${language}\0${code}`;
}

function readCachedReadOnlyMermaidMarkup(cacheKey: string) {
  const cached = readOnlyMermaidMarkupCache.get(cacheKey);
  if (cached == null) {
    return null;
  }

  readOnlyMermaidMarkupCache.delete(cacheKey);
  readOnlyMermaidMarkupCache.set(cacheKey, cached);
  return cached;
}

function cacheReadOnlyMermaidMarkup(cacheKey: string, markup: string) {
  readOnlyMermaidMarkupCache.set(cacheKey, markup);
  while (readOnlyMermaidMarkupCache.size > READONLY_MERMAID_RENDER_CACHE_LIMIT) {
    const oldestKey = readOnlyMermaidMarkupCache.keys().next().value;
    if (typeof oldestKey !== 'string') {
      break;
    }
    readOnlyMermaidMarkupCache.delete(oldestKey);
  }
  return markup;
}

export function clearReadOnlyMermaidRenderCaches() {
  readOnlyMermaidMarkupCache.clear();
  readOnlyMermaidRenderPromiseCache.clear();
}

export function getPendingReadOnlyMermaidRenderCount() {
  return readOnlyMermaidRenderPromiseCache.size;
}

export async function resolveReadOnlyMermaidMarkup(code: string, language = '') {
  if (code.length > MAX_MERMAID_CODE_CHARS) {
    return sanitizeMermaidMarkup(mermaidRenderErrorMarkup());
  }

  const cacheKey = getReadOnlyMermaidCacheKey(code, language);
  const cached = readCachedReadOnlyMermaidMarkup(cacheKey);
  if (cached != null) {
    return cached;
  }

  const existingPromise = readOnlyMermaidRenderPromiseCache.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }
  if (readOnlyMermaidRenderPromiseCache.size >= MAX_PENDING_READONLY_MERMAID_RENDERS) {
    return sanitizeMermaidMarkup(mermaidRenderErrorMarkup());
  }

  const promise = renderReadOnlyMermaid(code)
    .then((markup) => cacheReadOnlyMermaidMarkup(cacheKey, markup))
    .finally(() => {
      readOnlyMermaidRenderPromiseCache.delete(cacheKey);
    });
  readOnlyMermaidRenderPromiseCache.set(cacheKey, promise);
  return promise;
}

async function renderReadOnlyMermaid(code: string) {
  try {
    const markup = await renderMermaidMarkup(code, generateMermaidId());
    return sanitizeMermaidMarkup(markup);
  } catch {
    return sanitizeMermaidMarkup(mermaidRenderErrorMarkup());
  }
}

interface ReadOnlyMermaidBlockProps {
  code: string;
}

export function ReadOnlyMermaidBlock({ code }: ReadOnlyMermaidBlockProps) {
  const { language, t } = useI18n();
  const normalizedCode = useMemo(() => code.trim(), [code]);
  const diagramType = useMemo(() => getMermaidDiagramType(normalizedCode), [normalizedCode]);
  const [markup, setMarkup] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMarkup(null);
    setFailed(false);
    if (!normalizedCode) {
      return;
    }

    void resolveReadOnlyMermaidMarkup(normalizedCode, language).then((nextMarkup) => {
      if (cancelled) return;
      if (!nextMarkup) {
        setFailed(true);
        return;
      }
      setMarkup(nextMarkup);
    }).catch(() => {
      if (!cancelled) {
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [language, normalizedCode]);

  if (!normalizedCode) {
    return (
      <div
        className="mermaid-block mermaid-empty"
        data-type="mermaid"
        data-chat-selection-excluded="true"
        aria-hidden="true"
      >
        {'\u200b'}
      </div>
    );
  }

  if (failed) {
    return (
      <div
        className="mermaid-block mermaid-error"
        data-mermaid-diagram={diagramType ?? undefined}
        data-type="mermaid"
        data-chat-selection-excluded="true"
      >
        {t('editor.mermaidRenderError')}
      </div>
    );
  }

  if (!markup) {
    return (
      <div
        className="mermaid-block"
        data-mermaid-diagram={diagramType ?? undefined}
        data-type="mermaid"
        data-chat-selection-excluded="true"
      >
        <div className="mermaid-placeholder">{t('editor.mermaidPlaceholder')}</div>
      </div>
    );
  }

  return (
    <div
      className="mermaid-block"
      data-mermaid-diagram={diagramType ?? undefined}
      data-type="mermaid"
      data-chat-selection-excluded="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
