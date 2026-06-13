import { useEffect, useMemo, useState } from 'react';
import { translate } from '@/lib/i18n';
import {
  generateMermaidId,
  MAX_MERMAID_CODE_CHARS,
  mermaidRenderErrorMarkup,
  renderMermaid as renderMermaidMarkup,
} from './mermaidRenderer';
import { sanitizeMermaidMarkup } from './mermaidSanitizer';

const READONLY_MERMAID_RENDER_CACHE_LIMIT = 80;
export const MAX_PENDING_READONLY_MERMAID_RENDERS = 80;
const readOnlyMermaidMarkupCache = new Map<string, string>();
const readOnlyMermaidRenderPromiseCache = new Map<string, Promise<string>>();

function readCachedReadOnlyMermaidMarkup(code: string) {
  const cached = readOnlyMermaidMarkupCache.get(code);
  if (cached == null) {
    return null;
  }

  readOnlyMermaidMarkupCache.delete(code);
  readOnlyMermaidMarkupCache.set(code, cached);
  return cached;
}

function cacheReadOnlyMermaidMarkup(code: string, markup: string) {
  readOnlyMermaidMarkupCache.set(code, markup);
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

export async function resolveReadOnlyMermaidMarkup(code: string) {
  if (code.length > MAX_MERMAID_CODE_CHARS) {
    return sanitizeMermaidMarkup(mermaidRenderErrorMarkup());
  }

  const cached = readCachedReadOnlyMermaidMarkup(code);
  if (cached != null) {
    return cached;
  }

  const existingPromise = readOnlyMermaidRenderPromiseCache.get(code);
  if (existingPromise) {
    return existingPromise;
  }
  if (readOnlyMermaidRenderPromiseCache.size >= MAX_PENDING_READONLY_MERMAID_RENDERS) {
    return sanitizeMermaidMarkup(mermaidRenderErrorMarkup());
  }

  const promise = renderReadOnlyMermaid(code)
    .then((markup) => cacheReadOnlyMermaidMarkup(code, markup))
    .finally(() => {
      readOnlyMermaidRenderPromiseCache.delete(code);
    });
  readOnlyMermaidRenderPromiseCache.set(code, promise);
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
  const normalizedCode = useMemo(() => code.trim(), [code]);
  const [markup, setMarkup] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMarkup(null);
    setFailed(false);
    if (!normalizedCode) {
      return;
    }

    void resolveReadOnlyMermaidMarkup(normalizedCode).then((nextMarkup) => {
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
  }, [normalizedCode]);

  if (!normalizedCode) {
    return (
      <div
        className="mermaid-block mermaid-empty"
        data-type="mermaid"
        data-chat-selection-excluded="true"
      >
        {translate('editor.emptyDiagram')}
      </div>
    );
  }

  if (failed) {
    return (
      <div
        className="mermaid-block mermaid-error"
        data-type="mermaid"
        data-chat-selection-excluded="true"
      >
        {translate('editor.mermaidRenderError')}
      </div>
    );
  }

  if (!markup) {
    return (
      <div
        className="mermaid-block"
        data-type="mermaid"
        data-chat-selection-excluded="true"
      >
        <div className="mermaid-placeholder">{translate('editor.mermaidPlaceholder')}</div>
      </div>
    );
  }

  return (
    <div
      className="mermaid-block"
      data-type="mermaid"
      data-chat-selection-excluded="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
