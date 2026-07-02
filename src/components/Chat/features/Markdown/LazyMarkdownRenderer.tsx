import { lazy, Suspense } from 'react';
import type { MarkdownRendererProps } from './MarkdownRenderer';

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

function MarkdownRendererFallback({ content }: Pick<MarkdownRendererProps, 'content'>) {
  if (content.trim().length === 0) {
    return null;
  }

  return (
    <div
      data-chat-markdown-loading="true"
      className="max-w-full whitespace-pre-wrap break-words"
    >
      {content}
    </div>
  );
}

export function LazyMarkdownRenderer(props: MarkdownRendererProps) {
  return (
    <Suspense fallback={<MarkdownRendererFallback content={props.content} />}>
      <MarkdownRenderer {...props} />
    </Suspense>
  );
}
