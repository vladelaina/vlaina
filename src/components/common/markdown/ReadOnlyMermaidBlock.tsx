import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { translate } from '@/lib/i18n';
import { generateMermaidId, renderMermaid as renderMermaidMarkup } from './mermaidRenderer';

async function renderReadOnlyMermaid(code: string) {
  const markup = await renderMermaidMarkup(code, generateMermaidId());
  return DOMPurify.sanitize(markup, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'object', 'embed'],
  });
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

    void renderReadOnlyMermaid(normalizedCode).then((nextMarkup) => {
      if (cancelled) return;
      if (!nextMarkup) {
        setFailed(true);
        return;
      }
      setMarkup(nextMarkup);
    });

    return () => {
      cancelled = true;
    };
  }, [normalizedCode]);

  if (!normalizedCode) {
    return <div className="mermaid-block mermaid-empty" data-type="mermaid">{translate('editor.emptyDiagram')}</div>;
  }

  if (failed) {
    return <div className="mermaid-block mermaid-error" data-type="mermaid">{translate('editor.mermaidRenderError')}</div>;
  }

  if (!markup) {
    return (
      <div className="mermaid-block" data-type="mermaid" data-code={normalizedCode}>
        <div className="mermaid-placeholder">{translate('editor.mermaidPlaceholder')}</div>
      </div>
    );
  }

  return (
    <div
      className="mermaid-block"
      data-type="mermaid"
      data-code={normalizedCode}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
