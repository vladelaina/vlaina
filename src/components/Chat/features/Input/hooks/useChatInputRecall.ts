import { useCallback, useEffect } from 'react';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { limitChatComposerText } from '@/lib/ui/composerTextLimit';
import type { RecalledChatInputDraft } from '../ChatInputTypes';

interface UseChatInputRecallOptions {
  attachmentsLength: number;
  clearHistoryNavigationOnInput: () => void;
  handleCaretChange: (start: number, end?: number) => void;
  handleMessageChange: (message: string) => void;
  isQuotaSendBlocked: boolean;
  lastSubmittedMessageRef: { current: string };
  markExplicitMultiline: () => void;
  message: string;
  noteMentionsLength: number;
  onRecalledDraftConsumed?: (id?: number) => void;
  onStop: () => void;
  onStopAndRecall?: (lastSubmittedMessage?: string) => RecalledChatInputDraft | string | null | void;
  recalledDraft?: RecalledChatInputDraft | null;
  restoreAttachments: (attachments: Attachment[]) => void;
  restoreNoteMentions: (noteMentions: NoteMentionReference[]) => void;
  scheduleComposerFocus: (position?: number) => void;
}

export function useChatInputRecall({
  attachmentsLength,
  clearHistoryNavigationOnInput,
  handleCaretChange,
  handleMessageChange,
  isQuotaSendBlocked,
  lastSubmittedMessageRef,
  markExplicitMultiline,
  message,
  noteMentionsLength,
  onRecalledDraftConsumed,
  onStop,
  onStopAndRecall,
  recalledDraft,
  restoreAttachments,
  restoreNoteMentions,
  scheduleComposerFocus,
}: UseChatInputRecallOptions) {
  const restoreRecalledDraft = useCallback((draft: RecalledChatInputDraft | string | null | void): boolean => {
    const recalledDraft = typeof draft === 'string'
      ? { message: draft }
      : draft;
    if (!recalledDraft || typeof recalledDraft.message !== 'string') {
      return false;
    }

    const recalledMessage = limitChatComposerText(recalledDraft.message);
    const recalledAttachments = recalledDraft.attachments ?? [];
    const recalledNoteMentions = recalledDraft.noteMentions ?? [];
    if (
      recalledMessage.trim().length === 0 &&
      recalledAttachments.length === 0 &&
      recalledNoteMentions.length === 0
    ) {
      return false;
    }

    restoreAttachments(recalledAttachments);
    restoreNoteMentions(recalledNoteMentions);
    if (recalledMessage.includes('\n')) {
      markExplicitMultiline();
    }
    handleMessageChange(recalledMessage);
    clearHistoryNavigationOnInput();
    const nextCaret = recalledMessage.length;
    handleCaretChange(nextCaret);
    scheduleComposerFocus(nextCaret);
    return true;
  }, [
    clearHistoryNavigationOnInput,
    handleCaretChange,
    handleMessageChange,
    markExplicitMultiline,
    restoreAttachments,
    restoreNoteMentions,
    scheduleComposerFocus,
  ]);

  useEffect(() => {
    if (recalledDraft && !isQuotaSendBlocked) {
      onRecalledDraftConsumed?.(recalledDraft.id);
      return;
    }
    if (
      recalledDraft &&
      (
        message.trim().length > 0 ||
        attachmentsLength > 0 ||
        noteMentionsLength > 0
      )
    ) {
      return;
    }
    if (restoreRecalledDraft(recalledDraft)) {
      onRecalledDraftConsumed?.(recalledDraft?.id);
    }
  }, [
    attachmentsLength,
    isQuotaSendBlocked,
    message,
    noteMentionsLength,
    onRecalledDraftConsumed,
    recalledDraft,
    restoreRecalledDraft,
  ]);

  const handleStopButton = useCallback(() => {
    if (!onStopAndRecall) {
      onStop();
      return;
    }

    restoreRecalledDraft(onStopAndRecall(lastSubmittedMessageRef.current));
  }, [
    lastSubmittedMessageRef,
    onStop,
    onStopAndRecall,
    restoreRecalledDraft,
  ]);

  return {
    handleStopButton,
    restoreRecalledDraft,
  };
}
