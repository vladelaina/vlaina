import React, { isValidElement, useEffect, useState } from 'react';
import { getExternalLinkProps } from '@/lib/navigation/externalLinks';
import { writeTextToClipboard } from '@/lib/clipboard';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { copyImageSourceToClipboard } from '@/components/Chat/common/messageClipboard';
import { downloadImageWithPrompt } from '@/components/Chat/common/imageDownload';
import { ChatImageViewer } from './components/ChatImageViewer';
import { ReadOnlyCodeBlock } from '@/components/common/code-block';
import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import { ReadOnlyMermaidBlock } from '@/components/common/markdown/ReadOnlyMermaidBlock';
import { ReadOnlyVideoBlock } from '@/components/common/markdown/ReadOnlyVideoBlock';
import { normalizeImageWidth, serializeCropValue } from '@/components/common/markdown/imageSourceFragment';
import { isMermaidFenceLanguage } from '@/components/common/markdown/mermaidLanguage';
import { parseVideoUrl } from '@/components/common/markdown/videoUrl';
import { translate, useI18n } from '@/lib/i18n';

type ImageGalleryItem = { id: string; src: string };

type CreateMarkdownComponentsOptions = {
  codeBlockIndexOffset?: number;
  codeBlockIdBase?: string;
  copiedCodeBlockId?: string | null;
  getImageGallery?: () => ImageGalleryItem[];
  imageIndexOffset?: number;
  imageGallery?: ImageGalleryItem[];
  imageIdBase?: string;
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

async function copyImageOrUrl(src: string): Promise<boolean> {
  const copied = await copyImageSourceToClipboard(src);
  if (copied) {
    return true;
  }

  return writeTextToClipboard(src);
}

function isInternalHashHref(href: unknown): href is string {
  return typeof href === 'string' && /^#[A-Za-z0-9_-]+$/.test(href);
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

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      setCopied(await copyImageOrUrl(src));
    } catch {
      setCopied(false);
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
    <span className={cn('flex max-w-full', justifyClass)} data-no-focus-input="true">
      <span className="group relative inline-block max-w-full align-top">
        <LocalImage
          src={src}
          alt={alt || 'image'}
          className="block max-h-[420px] w-auto max-w-full object-contain"
          style={safeWidth ? { width: safeWidth } : undefined}
          data-vlaina-crop={safeCrop || undefined}
          onClick={() => {
            setIsViewerOpen(true);
          }}
        />
        <span
          className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          data-no-focus-input="true"
        >
          <button
            type="button"
            data-no-focus-input="true"
            aria-label={t('chat.copyImage')}
            onClick={(event) => {
              event.stopPropagation();
              void handleCopy();
            }}
            className={cn(
              'p-1.5',
              iconButtonStyles,
              copied && 'text-green-500 dark:text-green-400',
            )}
          >
            <Icon name={copied ? 'common.check' : 'common.copy'} size="md" />
          </button>
          <button
            type="button"
            data-no-focus-input="true"
            aria-label={t('chat.downloadImage')}
            onClick={(event) => {
              event.stopPropagation();
              void downloadImageWithPrompt(src, alt);
            }}
            className={cn('p-1.5', iconButtonStyles)}
          >
            <Icon name="common.download" size="md" />
          </button>
        </span>
      </span>
      <ChatImageViewer
        open={isViewerOpen}
        src={src}
        alt={alt}
        gallery={gallery}
        currentImageId={currentImageId}
        onOpenChange={setIsViewerOpen}
      />
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
        <ReadOnlyCodeBlock
          className={className}
          blockId={blockId}
          copied={copiedCodeBlockId === blockId}
          onCopy={onCopyCodeBlock}
          {...props}
        >
          {content}
        </ReadOnlyCodeBlock>
      );
    },
    p({ children, ...props }: MarkdownParagraphProps) {
      if (hasBlockLevelChild(children)) {
        return <div {...props}>{children}</div>;
      }

      return <p {...props}>{children}</p>;
    },
    img({ src, alt, align, width, dataVlainaCrop, 'data-vlaina-crop': dataVlainaCropKebab }: MarkdownImageProps) {
      const rawSrc = typeof src === 'string' ? src : null;
      if (rawSrc && parseVideoUrl(rawSrc)) {
        return <ReadOnlyVideoBlock src={rawSrc} title={typeof alt === 'string' ? alt : ''} />;
      }

      const safeSrc = normalizeRenderableImageSrc(rawSrc);
      if (!safeSrc) {
        return (
          <span className="inline-block rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
            [{translate('chat.imageUnavailable')}]
          </span>
        );
      }

      const currentImageId = imageIdBase ? `${imageIdBase}:${imageRenderIndex}` : undefined;
      imageRenderIndex += 1;

      return (
        <MarkdownImage
          src={safeSrc}
          alt={typeof alt === 'string' ? alt : 'image'}
          align={align}
          width={typeof width === 'number' ? `${width}px` : width}
          crop={dataVlainaCrop ?? dataVlainaCropKebab ?? null}
          imageGallery={imageGallery}
          getImageGallery={getImageGallery}
          currentImageId={currentImageId}
        />
      );
    },
  };
}
