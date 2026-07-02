import React, { isValidElement, useEffect, useState } from 'react';
import { getExternalLinkProps } from '@/lib/navigation/externalLinks';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { copyImageSourceToClipboard } from '@/components/Chat/common/messageClipboard';
import { downloadImageWithPrompt } from '@/components/Chat/common/imageDownload';
import { LazyChatImageViewer } from './components/LazyChatImageViewer';
import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import { normalizeChatMessageImageSource } from '@/lib/ai/chatImageSourcePolicy';
import { ReadOnlyMermaidBlock } from '@/components/common/markdown/ReadOnlyMermaidBlock';
import { ReadOnlyVideoBlock } from '@/components/common/markdown/ReadOnlyVideoBlock';
import { normalizeImageWidth, serializeCropValue } from '@/components/common/markdown/imageSourceFragment';
import { isMermaidFenceLanguage } from '@/components/common/markdown/mermaidLanguage';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import { translate, useI18n } from '@/lib/i18n';
import { resolveCompactedChatImageSrc } from './chatInlineImageTokens';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';
import { MAX_CHAT_MESSAGE_IMAGE_SOURCES } from '@/components/Chat/common/messageClipboard';
import { useToastStore } from '@/stores/useToastStore';

const ReadOnlyCodeBlock = React.lazy(async () => {
  const mod = await import('@/components/common/code-block');
  return { default: mod.ReadOnlyCodeBlock };
});

type ImageGalleryItem = { id: string; src: string };

type CreateMarkdownComponentsOptions = {
  codeBlockIndexOffset?: number;
  codeBlockIdBase?: string;
  copiedCodeBlockId?: string | null;
  getImageGallery?: () => ImageGalleryItem[];
  imageIndexOffset?: number;
  imageGallery?: ImageGalleryItem[];
  imageIdBase?: string;
  imageSrcByToken?: Map<string, string>;
  onCopyCodeBlock?: (blockId: string) => void;
};

type MarkdownAnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: React.ReactNode;
  href?: string;
};

type MarkdownCodeProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
  className?: string;
};

type MarkdownPreProps = Omit<MarkdownCodeProps, 'onCopy'>;

type MarkdownParagraphProps = React.HTMLAttributes<HTMLParagraphElement> & {
  children?: React.ReactNode;
};

type MarkdownTableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  children?: React.ReactNode;
};

type MarkdownImageProps = {
  align?: string;
  alt?: string;
  'data-vlaina-crop'?: string;
  dataVlainaCrop?: string;
  src?: string;
  width?: string | number;
};

const BLOCK_LEVEL_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'dialog',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
]);

function hasBlockLevelChild(children: React.ReactNode): boolean {
  const nodes = React.Children.toArray(children);
  for (const node of nodes) {
    if (!isValidElement(node)) {
      continue;
    }

    if (typeof node.type === 'string' && BLOCK_LEVEL_TAGS.has(node.type.toLowerCase())) {
      return true;
    }

    const nestedChildren = (node.props as { children?: React.ReactNode }).children;
    if (nestedChildren && hasBlockLevelChild(nestedChildren)) {
      return true;
    }
  }

  return false;
}

function resolvePreCodePayload(children: React.ReactNode): {
  className?: string;
  content: React.ReactNode;
} {
  if (isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode; className?: string };
    return {
      className: props.className,
      content: props.children,
    };
  }

  return {
    className: undefined,
    content: children,
  };
}

function ReadOnlyCodeBlockFallback({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <pre className={cn('my-4 overflow-x-auto rounded-2xl p-4', className)}>
      <code className="font-mono text-sm leading-relaxed">
        {children}
      </code>
    </pre>
  );
}

async function copyImageOrUrl(src: string): Promise<boolean> {
  return copyImageSourceToClipboard(src);
}

function stopImageControlMouseDown(event: React.MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function isInternalHashHref(href: unknown): href is string {
  return typeof href === 'string' && /^#[A-Za-z0-9_-]+$/.test(href);
}

function renderUnavailableImage() {
  return (
    <span
      className="inline-block rounded-md bg-[var(--vlaina-color-unavailable-bg)] px-2 py-1 text-xs text-[var(--vlaina-color-unavailable-fg)]"
      data-chat-selection-excluded="true"
    >
      [{translate('chat.imageUnavailable')}]
    </span>
  );
}

function MarkdownImage({
  src,
  alt,
  imageGallery,
  getImageGallery,
  currentImageId,
  align,
  width,
  crop,
}: {
  align?: string;
  alt?: string;
  currentImageId?: string;
  crop?: string | null;
  getImageGallery?: () => ImageGalleryItem[];
  imageGallery?: ImageGalleryItem[];
  src: string;
  width?: string | null;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [resolvedImageSrc, setResolvedImageSrc] = useState<string | null>(null);
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), themeUiFeedbackTokens.copyFeedbackDurationMs);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      const didCopy = await copyImageOrUrl(src);
      setCopied(didCopy);
      if (!didCopy) {
        addToast(t('chat.copyImageFailed'), 'error');
      }
    } catch {
      setCopied(false);
      addToast(t('chat.copyImageFailed'), 'error');
    }
  };

  const gallery = getImageGallery ? getImageGallery() : imageGallery;
  const normalizedAlign = align === 'left' || align === 'right' || align === 'center' ? align : 'center';
  const justifyClass = normalizedAlign === 'left'
    ? 'justify-start'
    : normalizedAlign === 'right'
      ? 'justify-end'
      : 'justify-center';
  const safeWidth = normalizeImageWidth(width);
  const safeCrop = serializeCropValue(crop);

  return (
    <span
      className={cn('flex max-w-full select-none', justifyClass)}
      data-chat-selection-excluded="true"
      data-no-focus-input="true"
    >
      <span className="group relative inline-block max-w-full select-none align-top">
        <LocalImage
          src={src}
          alt={alt || 'image'}
          className="block max-h-[var(--vlaina-size-420px)] w-auto max-w-full select-none object-contain"
          style={safeWidth ? { width: safeWidth } : undefined}
          data-vlaina-crop={safeCrop || undefined}
          onResolvedSrc={setResolvedImageSrc}
          onClick={() => {
            setIsViewerOpen(true);
          }}
        />
        <span
          className="absolute right-2 top-2 z-[var(--vlaina-z-10)] flex items-center gap-1 opacity-[var(--vlaina-opacity-0)] transition-opacity duration-[var(--vlaina-duration-150)] group-hover:opacity-[var(--vlaina-opacity-100)]"
          data-no-focus-input="true"
        >
          <button
            type="button"
            data-no-focus-input="true"
            data-action="copy"
            aria-label={t('chat.copyImage')}
            onMouseDown={stopImageControlMouseDown}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleCopy();
            }}
            className={cn('toolbar-btn', copied && 'active')}
          >
            <Icon name={copied ? 'common.check' : 'common.copy'} size="md" />
          </button>
          <button
            type="button"
            data-no-focus-input="true"
            aria-label={t('chat.downloadImage')}
            onMouseDown={stopImageControlMouseDown}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void downloadImageWithPrompt(src, alt).catch(() => undefined);
            }}
            className={cn('p-1.5', iconButtonStyles)}
          >
            <Icon name="common.download" size="md" />
          </button>
        </span>
      </span>
      {isViewerOpen ? (
        <LazyChatImageViewer
          open={isViewerOpen}
          src={src}
          alt={alt}
          gallery={gallery}
          currentImageId={currentImageId}
          previewSrc={resolvedImageSrc}
          onOpenChange={setIsViewerOpen}
        />
      ) : null}
    </span>
  );
}

export function createMarkdownComponents({
  codeBlockIndexOffset = 0,
  codeBlockIdBase,
  copiedCodeBlockId,
  getImageGallery,
  imageIndexOffset = 0,
  imageGallery,
  imageIdBase,
  imageSrcByToken,
  onCopyCodeBlock,
}: CreateMarkdownComponentsOptions) {
  let imageRenderIndex = imageIndexOffset;
  let codeBlockRenderIndex = codeBlockIndexOffset;

  return {
    a({ href, children, ...props }: MarkdownAnchorProps) {
      if (isInternalHashHref(href)) {
        return (
          <a
            {...props}
            href={href}
            className={cn(
              props.className,
              (href.startsWith('#heading-') || href.startsWith('#user-content-heading-')) && 'toc-link'
            )}
            data-no-focus-input="true"
          >
            {children}
          </a>
        );
      }

      return (
        <a
          {...props}
          {...getExternalLinkProps(typeof href === 'string' ? href : null)}
          data-no-focus-input="true"
        >
          {children}
        </a>
      );
    },
    code({ className, children, ...props }: MarkdownCodeProps) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre({ children, ...props }: MarkdownPreProps) {
      const { className, content } = resolvePreCodePayload(children);
      const language = typeof className === 'string'
        ? className.match(/language-([\w+-]+)/)?.[1] ?? ''
        : '';
      if (isMermaidFenceLanguage(language)) {
        return <ReadOnlyMermaidBlock code={String(content ?? '')} />;
      }

      const blockId = `${codeBlockIdBase || 'code'}:${codeBlockRenderIndex}`;
      codeBlockRenderIndex += 1;

      return (
        <React.Suspense
          fallback={(
            <ReadOnlyCodeBlockFallback className={className}>
              {content}
            </ReadOnlyCodeBlockFallback>
          )}
        >
          <ReadOnlyCodeBlock
            className={className}
            blockId={blockId}
            copied={copiedCodeBlockId === blockId}
            onCopy={onCopyCodeBlock}
            {...props}
          >
            {content}
          </ReadOnlyCodeBlock>
        </React.Suspense>
      );
    },
    p({ children, ...props }: MarkdownParagraphProps) {
      if (hasBlockLevelChild(children)) {
        return <div {...props}>{children}</div>;
      }

      return <p {...props}>{children}</p>;
    },
    table({ children, ...props }: MarkdownTableProps) {
      return (
        <div className="markdown-table-scroll" data-markdown-table-scroll="true">
          <table {...props}>{children}</table>
        </div>
      );
    },
    img({ src, alt, align, width, dataVlainaCrop: cropDataProp, 'data-vlaina-crop': cropDataAttr }: MarkdownImageProps) {
      const rawSrc = typeof src === 'string' ? src : null;
      const normalizedRawSrc = normalizeRenderableImageSrc(rawSrc);
      if (!normalizedRawSrc) {
        return renderUnavailableImage();
      }

      const resolvedSrc = resolveCompactedChatImageSrc(normalizedRawSrc, imageSrcByToken);
      if (parseVideoUrl(resolvedSrc)) {
        return <ReadOnlyVideoBlock src={resolvedSrc} title={typeof alt === 'string' ? alt : ''} />;
      }

      const safeSrc = normalizeChatMessageImageSource(resolvedSrc);
      if (!safeSrc) {
        return renderUnavailableImage();
      }

      if (imageRenderIndex >= MAX_CHAT_MESSAGE_IMAGE_SOURCES) {
        imageRenderIndex += 1;
        return null;
      }

      const currentImageId = imageIdBase ? `${imageIdBase}:${imageRenderIndex}` : undefined;
      imageRenderIndex += 1;

      return (
        <MarkdownImage
          src={safeSrc}
          alt={typeof alt === 'string' ? alt : 'image'}
          align={align}
          width={typeof width === 'number' ? `${width}px` : width}
          crop={cropDataProp ?? cropDataAttr ?? null}
          imageGallery={imageGallery}
          getImageGallery={getImageGallery}
          currentImageId={currentImageId}
        />
      );
    },
  };
}
