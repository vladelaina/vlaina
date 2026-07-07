import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import {
  READONLY_MARKDOWN_REMARK_PLUGINS,
} from '@/components/common/markdown/markdownPipeline';
import {
  createMarkdownSanitizeSchema,
  normalizeRenderableDataImageSrc,
  rehypeImageSrcSanitizer,
  rehypeImageSrcsetSanitizer,
  rehypeRawHtmlUrlSanitizer,
} from '@/components/common/markdown/imagePolicy';
import { KATEX_SHARED_RENDER_OPTIONS } from '@/components/common/markdown/katexOptions';
import { rehypeKatexSourceSanitizer } from '@/components/common/markdown/katexSourceSanitizer';
import { rehypeDropUnsafeRawHtmlContent } from '@/components/common/markdown/rawHtmlSanitizer';
import { normalizeImageWidth, serializeCropValue } from '@/components/common/markdown/imageSourceFragment';
import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';
import {
  getNoteInternalImageAssetPath,
  isLocalNetworkHttpUrl,
  isPublicRemoteMediaUrl,
  sanitizeNoteLinkHref,
  sanitizeNoteMediaSrc,
} from '@/lib/notes/markdown/urlSecurity';
import { cn } from '@/lib/utils';

const BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA = createMarkdownSanitizeSchema();
const EXPORT_BLOCKED_LOADABLE_RAW_HTML_TAGS = new Set(['audio', 'iframe', 'track', 'video']);

const NOTE_EXPORT_MARKDOWN_SANITIZE_SCHEMA = {
  ...BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA,
  tagNames: (BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA.tagNames || []).filter(
    (tagName: string) => !EXPORT_BLOCKED_LOADABLE_RAW_HTML_TAGS.has(tagName),
  ),
  protocols: {
    ...(BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA.protocols || {}),
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https', 'data'],
  },
};

const NOTE_EXPORT_REHYPE_PLUGINS = [
  rehypeDropUnsafeRawHtmlContent,
  rehypeRaw,
  rehypeDropUnsafeRawHtmlContent,
  rehypeImageSrcSanitizer,
  [rehypeSanitize, NOTE_EXPORT_MARKDOWN_SANITIZE_SCHEMA],
  rehypeRawHtmlUrlSanitizer,
  rehypeImageSrcsetSanitizer,
  [rehypeKatex, KATEX_SHARED_RENDER_OPTIONS],
  rehypeKatexSourceSanitizer,
] as any[];

function sanitizeExportLinkHref(value: unknown): string | null {
  const safeHref = sanitizeNoteLinkHref(value);
  if (!safeHref) {
    return null;
  }

  if (safeHref.startsWith('/')) {
    return null;
  }

  if (/^https?:/i.test(safeHref) && isLocalNetworkHttpUrl(safeHref)) {
    return null;
  }

  return safeHref;
}

function renderExportLink(props: any) {
  const safeHref = sanitizeExportLinkHref(props.href);
  if (!safeHref) {
    return <>{props.children}</>;
  }

  return (
    <a href={safeHref}>
      {props.children}
    </a>
  );
}

function renderExportImage(props: any) {
  const rawSrc = typeof props.src === 'string' ? props.src : '';
  const safeWidth = normalizeImageWidth(typeof props.width === 'number' ? `${props.width}px` : props.width);
  const rawCrop = props.dataVlainaCrop ?? props['data-vlaina-crop'];
  const safeCrop = serializeCropValue(rawCrop);
  const align = props.align === 'left' || props.align === 'right' || props.align === 'center'
    ? props.align
    : undefined;
  const imageStyle: React.CSSProperties = {
    ...(safeWidth ? { width: safeWidth } : {}),
    ...(align === 'center' ? { display: 'block', marginLeft: 'auto', marginRight: 'auto' } : {}),
    ...(align === 'right' ? { display: 'block', marginLeft: 'auto' } : {}),
  };
  const safeDataSrc = normalizeRenderableDataImageSrc(rawSrc);
  if (safeDataSrc) {
    return (
      <img
        src={safeDataSrc}
        alt={props.alt ?? ''}
        title={props.title}
        style={Object.keys(imageStyle).length > 0 ? imageStyle : undefined}
        data-vlaina-crop={safeCrop ?? undefined}
      />
    );
  }

  const safeSrc = sanitizeNoteMediaSrc(rawSrc);
  const localSrc = getNoteInternalImageAssetPath(safeSrc) ?? safeSrc;
  if (
    !safeSrc
    || /^blob:/i.test(safeSrc)
    || isPublicRemoteMediaUrl(safeSrc)
    || hasInternalNoteAssetUrlPathSegment(localSrc)
  ) {
    return null;
  }

  return (
    <img
      src={safeSrc}
      alt={props.alt ?? ''}
      title={props.title}
      style={Object.keys(imageStyle).length > 0 ? imageStyle : undefined}
      data-vlaina-crop={safeCrop ?? undefined}
    />
  );
}

function transformExportUrl(value: string, key: string): string {
  if (key === 'href') {
    return sanitizeExportLinkHref(value) ?? '';
  }
  return value;
}

export function NoteExportDocument({
  markdown,
  title,
  className,
}: {
  markdown: string;
  title: string;
  className?: string;
}) {
  return (
    <article className={cn('note-export', className)}>
      <h1 className="note-export-title">{title}</h1>
      <div className="note-export-body">
        <ReactMarkdown
          remarkPlugins={READONLY_MARKDOWN_REMARK_PLUGINS}
          rehypePlugins={NOTE_EXPORT_REHYPE_PLUGINS}
          urlTransform={transformExportUrl}
          components={{
            a: renderExportLink,
            img: renderExportImage,
            source: () => null,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}
