import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import {
  READONLY_MARKDOWN_REMARK_PLUGINS,
} from '@/components/common/markdown/markdownPipeline';
import { remarkObsidianImageEmbeds } from '@/components/common/markdown/obsidianImageEmbed';

type MarkdownAstNode = {
  children?: MarkdownAstNode[];
  position?: {
    start?: { line?: number };
    end?: { line?: number };
  };
  type?: string;
  value?: string;
};

const READONLY_MARKDOWN_BLANK_LINE_HTML = '<div class="notes-readonly-markdown-blank-line"></div>';

function remarkReadonlyMarkdownBlankLines() {
  return (tree: MarkdownAstNode) => {
    const children = tree.children;
    if (!Array.isArray(children) || children.length < 2) {
      return;
    }

    const nextChildren: MarkdownAstNode[] = [];
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      nextChildren.push(child);

      const nextChild = children[index + 1];
      const currentEndLine = child?.position?.end?.line;
      const nextStartLine = nextChild?.position?.start?.line;
      if (
        typeof currentEndLine !== 'number' ||
        typeof nextStartLine !== 'number' ||
        nextStartLine <= currentEndLine + 1
      ) {
        continue;
      }

      for (let line = currentEndLine + 1; line < nextStartLine; line += 1) {
        nextChildren.push({
          type: 'html',
          value: READONLY_MARKDOWN_BLANK_LINE_HTML,
        });
      }
    }

    tree.children = nextChildren;
  };
}

export const SPLIT_PREVIEW_REMARK_PLUGINS = [
  ...READONLY_MARKDOWN_REMARK_PLUGINS,
  remarkObsidianImageEmbeds,
  remarkReadonlyMarkdownBlankLines,
] as any[];

function isAlreadyRenderableImageSrc(src: string): boolean {
  return /^(?:https?:|data:|blob:|attachment:|app-file:|asset:)/i.test(src);
}

export interface ReactMarkdownImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  node?: unknown;
}

interface SplitPreviewMarkdownImageProps extends ReactMarkdownImageProps {
  loadImage: (src: string) => Promise<string>;
}

export function SplitPreviewMarkdownImage({
  alt,
  className,
  loadImage,
  node: _node,
  src,
  ...props
}: SplitPreviewMarkdownImageProps) {
  const originalSrc = typeof src === 'string' ? src : '';
  const [resolvedSrc, setResolvedSrc] = useState(originalSrc);

  useEffect(() => {
    let cancelled = false;

    if (!originalSrc || isAlreadyRenderableImageSrc(originalSrc)) {
      setResolvedSrc(originalSrc);
      return () => {
        cancelled = true;
      };
    }

    setResolvedSrc('');
    void loadImage(originalSrc)
      .then((url) => {
        if (!cancelled) {
          setResolvedSrc(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedSrc(originalSrc);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadImage, originalSrc]);

  const imageBlockAttrs = originalSrc
    ? {
        'data-src': originalSrc,
        'data-inject-url': originalSrc,
        src: originalSrc,
      }
    : {};

  return (
    <span
      {...imageBlockAttrs}
      className="image-block-container md-image image-embed block w-full max-w-full"
      data-alt={alt || undefined}
    >
      <img
        {...props}
        alt={alt ?? ''}
        className={cn('block h-auto max-w-full select-none', className)}
        data-inject-url={originalSrc || undefined}
        data-src={originalSrc || undefined}
        draggable={false}
        referrerPolicy="no-referrer"
        src={resolvedSrc || originalSrc}
      />
    </span>
  );
}
