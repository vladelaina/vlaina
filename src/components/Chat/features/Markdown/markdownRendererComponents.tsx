import React, { isValidElement, useEffect, useState } from 'react';
import { getExternalLinkProps } from '@/lib/navigation/externalLinks';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { copyImageSourceToClipboard } from '@/components/Chat/common/messageClipboard';
import { downloadImageWithPrompt } from '@/components/Chat/common/imageDownload';
import { ChatImageViewer } from './components/ChatImageViewer';
import { CodeBlock } from './components/CodeBlock';
import { normalizeRenderableImageSrc } from './imagePolicy';

type ImageGalleryItem = { id: string; src: string };

type CreateMarkdownComponentsOptions = {
  codeBlockIdBase?: string;
  copiedCodeBlockId?: string | null;
  getImageGallery?: () => ImageGalleryItem[];
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
  alt?: string;
  src?: string;
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

async function copyImageOrUrl(src: string): Promise<void> {
  const copied = await copyImageSourceToClipboard(src);
  if (copied) {
    return;
  }

  await navigator.clipboard.writeText(src);
}

function MarkdownImage({
  src,
  alt,
  imageGallery,
  getImageGallery,
  currentImageId,
}: {
  alt?: string;
  currentImageId?: string;
  getImageGallery?: () => ImageGalleryItem[];
  imageGallery?: ImageGalleryItem[];
  src: string;
}) {
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
      await copyImageOrUrl(src);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const gallery = getImageGallery ? getImageGallery() : imageGallery;

  return (
    <span className="not-prose my-3 block max-w-full" data-no-focus-input="true">
      <span className="group relative inline-block max-w-full overflow-hidden rounded-xl align-top">
        <LocalImage
          src={src}
          alt={alt || 'image'}
          className="block max-h-[420px] w-auto max-w-full object-contain"
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
            aria-label="Copy image"
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
            aria-label="Download image"
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
  codeBlockIdBase,
  copiedCodeBlockId,
  getImageGallery,
  imageGallery,
  imageIdBase,
  onCopyCodeBlock,
}: CreateMarkdownComponentsOptions) {
  let imageRenderIndex = 0;
  let codeBlockRenderIndex = 0;

  return {
    a({ href, children, ...props }: MarkdownAnchorProps) {
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
        <code
          className={cn(
            'rounded bg-neutral-100 px-1 py-0.5 text-sm dark:bg-neutral-800',
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    },
    pre({ children, ...props }: MarkdownPreProps) {
      const { className, content } = resolvePreCodePayload(children);
      const blockId = `${codeBlockIdBase || 'code'}:${codeBlockRenderIndex}`;
      codeBlockRenderIndex += 1;

      return (
        <CodeBlock
          className={className}
          blockId={blockId}
          copied={copiedCodeBlockId === blockId}
          onCopy={onCopyCodeBlock}
          {...props}
        >
          {content}
        </CodeBlock>
      );
    },
    p({ children, ...props }: MarkdownParagraphProps) {
      if (hasBlockLevelChild(children)) {
        return <div {...props}>{children}</div>;
      }

      return <p {...props}>{children}</p>;
    },
    img({ src, alt }: MarkdownImageProps) {
      const safeSrc = normalizeRenderableImageSrc(typeof src === 'string' ? src : null);
      if (!safeSrc) {
        return (
          <span className="inline-block rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
            [Image unavailable]
          </span>
        );
      }

      const currentImageId = imageIdBase ? `${imageIdBase}:${imageRenderIndex}` : undefined;
      imageRenderIndex += 1;

      return (
        <MarkdownImage
          src={safeSrc}
          alt={typeof alt === 'string' ? alt : 'image'}
          imageGallery={imageGallery}
          getImageGallery={getImageGallery}
          currentImageId={currentImageId}
        />
      );
    },
  };
}
