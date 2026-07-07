import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type { Attachment } from '@/lib/storage/attachmentStorage';

export interface ChatInputProps {
  active?: boolean;
  onSend: (message: string, attachments: Attachment[], noteMentions: NoteMentionReference[]) => void | boolean | Promise<void | boolean>;
  onStop: () => void;
  onStopAndRecall?: (lastSubmittedMessage?: string) => RecalledChatInputDraft | string | null | void;
  recalledDraft?: RecalledChatInputDraft | null;
  onRecalledDraftConsumed?: (id?: number) => void;
  isLoading: boolean;
  hasSelectedModel: boolean;
  isManagedQuotaExhausted?: boolean;
  focusTrigger?: number;
  sessionId?: string | null;
  sentUserMessages: string[];
  acceptNotesBlockDrop?: boolean;
}

export interface RecalledChatInputDraft {
  id?: number;
  message: string;
  attachments?: Attachment[];
  noteMentions?: NoteMentionReference[];
}
