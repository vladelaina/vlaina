import { lazy, Suspense } from 'react';
import type { ChatImageViewerProps } from './ChatImageViewer';

const ChatImageViewer = lazy(async () => {
  const mod = await import('./ChatImageViewer');
  return { default: mod.ChatImageViewer };
});

export function LazyChatImageViewer(props: ChatImageViewerProps) {
  return (
    <Suspense fallback={null}>
      <ChatImageViewer {...props} />
    </Suspense>
  );
}
