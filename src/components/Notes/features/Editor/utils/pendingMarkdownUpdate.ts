import {
  normalizeSerializedMarkdownDocument,
  restoreMathBlockFenceStylesFromReference,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeLeadingFrontmatterMarkdown } from '../plugins/frontmatter/frontmatterMarkdown';

type PendingMarkdownUpdateResolution = {
  markdownToApply: string;
  source: 'pending-markdown' | 'live-editor' | 'pending-markdown-without-live-editor';
  liveMarkdown: string | null;
};

export function resolvePendingMarkdownUpdate({
  pendingMarkdown,
  latestNoteContent,
  liveSerializedMarkdown,
}: {
  pendingMarkdown: string;
  latestNoteContent: string;
  liveSerializedMarkdown: string | null;
}): PendingMarkdownUpdateResolution {
  if (liveSerializedMarkdown === null) {
    return {
      markdownToApply: pendingMarkdown,
      source: 'pending-markdown-without-live-editor',
      liveMarkdown: null,
    };
  }

  const liveMarkdown = serializeLeadingFrontmatterMarkdown(
    restoreMathBlockFenceStylesFromReference(
      normalizeSerializedMarkdownDocument(liveSerializedMarkdown),
      latestNoteContent,
    ),
    latestNoteContent,
  );

  if (liveMarkdown !== pendingMarkdown) {
    return {
      markdownToApply: liveMarkdown,
      source: 'live-editor',
      liveMarkdown,
    };
  }

  return {
    markdownToApply: pendingMarkdown,
    source: 'pending-markdown',
    liveMarkdown,
  };
}
