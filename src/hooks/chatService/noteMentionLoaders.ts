import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { findNode } from '@/stores/notes/fileTreeUtils';
import { stripManagedFrontmatter } from '@/stores/notes/frontmatter';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { mapWithConcurrencyLimit } from './helperCore';
import {
  MAX_CHAT_MENTION_LOAD_CONCURRENCY,
  MAX_FOLDER_MENTION_NOTE_CANDIDATES,
  MAX_FOLDER_MENTION_NOTES,
  MAX_MENTIONED_NOTES_CONTEXT_CHARS,
  MAX_NOTE_MENTION_CHARS,
} from './noteMentionConfig';
import { normalizeNoteMentionsForLoading } from './noteMentionNormalize';
import { resolveMentionedNoteContent } from './noteMentionContent';
import { loadFolderListingReference } from './folderListingReference';
import { loadScannedFolderMarkdownReferences } from './folderMarkdownReferences';
import { loadFolderImageAttachmentsForMention } from './folderImageAttachments';
import {
  collectMentionFolderMarkdownNodes,
  formatPromptLabel,
} from './folderScanUtils';

async function loadMentionReference(
  mention: NoteMentionReference
): Promise<Array<NoteMentionReference & { content: string }>> {
  const notesState = useNotesStore.getState();
  const folderNode = notesState.rootFolder
    ? findNode(notesState.rootFolder.children, mention.path)
    : null;
  const isFolderMention = mention.kind === 'folder' || Boolean(folderNode?.isFolder);

  if (!isFolderMention) {
    const content = stripManagedFrontmatter(
      await resolveMentionedNoteContent(mention.path),
    ).trim();
    return content ? [{ ...mention, content }] : [];
  }

  if (!folderNode?.isFolder) {
    if (mention.kind === 'folder') {
      const listing = await loadFolderListingReference(mention);
      const scannedReferences = await loadScannedFolderMarkdownReferences(mention);
      return listing ? [listing, ...scannedReferences] : scannedReferences;
    }
    return [];
  }

  const markdownNodes = collectMentionFolderMarkdownNodes(folderNode.children, {
    maxResults: MAX_FOLDER_MENTION_NOTE_CANDIDATES,
  });
  const listing = await loadFolderListingReference(mention);
  if (markdownNodes.length === 0) {
    const scannedReferences = await loadScannedFolderMarkdownReferences(mention);
    return listing ? [listing, ...scannedReferences] : scannedReferences;
  }

  const loaded = await mapWithConcurrencyLimit(
    markdownNodes,
    MAX_CHAT_MENTION_LOAD_CONCURRENCY,
    async (node) => {
      const title = notesState.getDisplayName?.(node.path) ?? node.name;
      const content = stripManagedFrontmatter(
        await resolveMentionedNoteContent(node.path),
      ).trim();
      return {
        path: node.path,
        title: `${mention.title.replace(/\/+$/, '')}/${title}`,
        kind: 'note' as const,
        content,
      };
    },
  );
  const markdownReferences = loaded
    .filter((note) => note.content.length > 0)
    .slice(0, MAX_FOLDER_MENTION_NOTES);
  return listing ? [listing, ...markdownReferences] : markdownReferences;
}

export async function loadMentionedNotes(
  noteMentions: unknown
): Promise<Array<NoteMentionReference & { content: string }>> {
  flushCurrentPendingEditorMarkdown();
  const normalizedMentions = normalizeNoteMentionsForLoading(noteMentions);
  return (await mapWithConcurrencyLimit(
    normalizedMentions,
    MAX_CHAT_MENTION_LOAD_CONCURRENCY,
    loadMentionReference,
  )).flat();
}

export async function loadMentionedFolderImageAttachments(
  noteMentions: unknown
): Promise<Attachment[]> {
  const normalizedMentions = normalizeNoteMentionsForLoading(noteMentions);
  const attachments = (await mapWithConcurrencyLimit(
    normalizedMentions,
    MAX_CHAT_MENTION_LOAD_CONCURRENCY,
    loadFolderImageAttachmentsForMention,
  )).flat();
  const seenPaths = new Set<string>();
  return attachments.filter((attachment) => {
    if (!attachment.path || seenPaths.has(attachment.path)) {
      return false;
    }
    seenPaths.add(attachment.path);
    return true;
  });
}

export function buildMentionedNotesContext(
  mentionedNotes: Array<NoteMentionReference & { content: string }>
): string {
  if (mentionedNotes.length === 0) {
    return '';
  }

  const prefix = 'Referenced notes and folders:\n\n';
  const suffix = '\n\nAnswer based on these references plus the user request.';
  const sections: string[] = [];
  let usedChars = prefix.length + suffix.length;

  for (const note of mentionedNotes) {
    const separator = sections.length > 0 ? '\n\n---\n\n' : '';
    const heading = `## ${formatPromptLabel(note.title, note.path || 'note')}\n`;
    const remainingChars = MAX_MENTIONED_NOTES_CONTEXT_CHARS
      - usedChars
      - separator.length
      - heading.length;
    if (remainingChars <= 0) {
      break;
    }

    const boundedContent = note.content.slice(0, Math.min(MAX_NOTE_MENTION_CHARS, remainingChars));
    const section = `${heading}${boundedContent}`;
    sections.push(section);
    usedChars += separator.length + section.length;
  }

  if (sections.length === 0) {
    return '';
  }

  return `${prefix}${sections.join('\n\n---\n\n')}${suffix}`;
}
