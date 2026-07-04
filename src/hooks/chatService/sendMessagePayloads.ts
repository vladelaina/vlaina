import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import {
  buildMentionedNotesContext,
  buildMessageFileAttachmentContext,
  buildMessageImageSources,
  isImageAttachment,
  limitChatMessageImageAttachments,
  loadMentionedFolderImageAttachments,
  loadMentionedNotes,
  normalizeVisionAttachment,
} from './helpers';
import { throwIfChatRequestAborted } from './requestLifecycle';

interface SendMessageStorageContentOptions {
  requestAttachments: Attachment[];
  userMessageText: string;
  mentionText: string;
  noteMentions: NoteMentionReference[];
}

interface SendMessageStorageContent {
  storageContent: string;
  messageImageSources: string[];
}

export async function buildSendMessageStorageContent({
  requestAttachments,
  userMessageText,
  mentionText,
  noteMentions,
}: SendMessageStorageContentOptions): Promise<SendMessageStorageContent> {
  let storageContent = userMessageText;
  let messageImageSources: string[] = [];
  if (requestAttachments.length > 0) {
    const [builtImages, fileAttachmentContext] = await Promise.all([
      buildMessageImageSources(requestAttachments),
      buildMessageFileAttachmentContext(requestAttachments),
    ]);
    const imageMarkdown = builtImages.content;
    messageImageSources = builtImages.imageSources;
    storageContent = [
      imageMarkdown,
      fileAttachmentContext,
      userMessageText,
    ].filter((part) => part.trim()).join('\n\n');
  }

  if (!storageContent.trim() && noteMentions.length > 0) {
    storageContent = mentionText;
  }

  return {
    storageContent,
    messageImageSources,
  };
}

interface SendMessageApiContentOptions {
  requestAttachments: Attachment[];
  userMessageText: string;
  noteMentions: NoteMentionReference[];
  signal: AbortSignal;
}

export async function buildSendMessageApiContent({
  requestAttachments,
  userMessageText,
  noteMentions,
  signal,
}: SendMessageApiContentOptions): Promise<ChatMessageContent> {
  throwIfChatRequestAborted(signal);
  const mentionedNotes = await loadMentionedNotes(noteMentions);
  throwIfChatRequestAborted(signal);
  const mentionedFolderImages = await loadMentionedFolderImageAttachments(noteMentions);
  throwIfChatRequestAborted(signal);
  const notesContext = buildMentionedNotesContext(mentionedNotes);
  const fileAttachmentContext = await buildMessageFileAttachmentContext(requestAttachments);
  throwIfChatRequestAborted(signal);
  const requestText = [
    fileAttachmentContext,
    userMessageText,
  ].filter((part) => part.trim()).join('\n\n');
  const textPayload = notesContext
    ? requestText
      ? `${notesContext}\n\nUser request:\n${requestText}`
      : `${notesContext}\n\nUser request: (none)`
    : requestText;

  let apiMessageContent: ChatMessageContent = textPayload;
  const apiAttachments = limitChatMessageImageAttachments([
    ...requestAttachments.filter(isImageAttachment),
    ...mentionedFolderImages,
  ]);
  if (apiAttachments.length > 0) {
    const parts: ChatMessageContentPart[] = [];
    if (textPayload) {
      parts.push({ type: 'text', text: textPayload });
    }
    for (const attachment of apiAttachments) {
      throwIfChatRequestAborted(signal);
      const imagePart = await normalizeVisionAttachment(attachment);
      throwIfChatRequestAborted(signal);
      if (imagePart) {
        parts.push(imagePart);
      }
    }
    if (parts.length > 0) {
      apiMessageContent = parts;
    }
  }

  return apiMessageContent;
}
