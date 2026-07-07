import type { RefObject } from 'react';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import type {
  MentionPreviewPart,
  NoteMentionCandidate,
} from '../noteMentionHelpers';

export type SyncMentionsContext = {
  allNoteCandidates: NoteMentionCandidate[];
  mentions: NoteMentionReference[];
  value: string;
};

export type IndexedNoteMentionCandidate = NoteMentionCandidate & {
  lowerTitle: string;
  lowerPath: string;
};

export type MentionPreviewRange = MentionPreviewPart & { mention: NoteMentionReference };

export interface UseNoteMentionStateOptions {
  value: string;
  onValueChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  syncMentions: (context: SyncMentionsContext) => NoteMentionReference[];
  removeLastMentionOnBoundary?: boolean;
}
