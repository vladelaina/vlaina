import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { limitChatComposerText } from '@/lib/ui/composerTextLimit';
import {
  isImageAttachment,
  isTextAttachment,
  limitChatMessageAttachments,
  normalizeNoteMentions,
} from './helpers';

const INVISIBLE_BREAK_REGEX = /[\u200b\u200c\u200d\ufeff]/g;
const UNIVERSAL_NEWLINE_REGEX = /\r\n?|\u2028|\u2029|\u0085/g;

export interface NormalizedSendMessageInput {
  isEmpty: boolean;
  userMessageText: string;
  mentionText: string;
  attachments: Attachment[];
  noteMentions: NoteMentionReference[];
  hasUnsupportedAttachments: boolean;
}

export function normalizeSendMessageInput(
  text: string,
  attachments: Attachment[],
  noteMentions: NoteMentionReference[],
): NormalizedSendMessageInput {
  const limitedText = limitChatComposerText(text);
  const normalizedAttachments = limitChatMessageAttachments(attachments || []);
  const normalizedMentions = normalizeNoteMentions(noteMentions);
  const normalizedInput = limitChatComposerText(limitedText
    .replace(INVISIBLE_BREAK_REGEX, '')
    .replace(UNIVERSAL_NEWLINE_REGEX, '\n'));
  const userMessageText = normalizedInput.trim();

  return {
    isEmpty: (
      (!limitedText || limitedText.trim().length === 0) &&
      normalizedAttachments.length === 0 &&
      normalizedMentions.length === 0
    ),
    userMessageText,
    mentionText: normalizedMentions.map((mention) => `@${mention.title}`).join(' '),
    attachments: normalizedAttachments,
    noteMentions: normalizedMentions,
    hasUnsupportedAttachments: normalizedAttachments.some((attachment) =>
      !isImageAttachment(attachment) && !isTextAttachment(attachment)
    ),
  };
}
